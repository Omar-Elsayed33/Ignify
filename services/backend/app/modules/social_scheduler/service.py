"""Social scheduler service — orchestration layer over `app.integrations.social`.

Keeps DB-shaped concerns here (SocialAccount/SocialPost CRUD, listing, cancel,
suggest best times). Platform-specific OAuth + publish logic lives in the
per-platform connectors under `app.integrations.social`.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ContentPost, SocialAccount, SocialPlatform, SocialPost, SocialPostStatus
from app.integrations.social import get_connector
from app.integrations.social import oauth_state
from app.integrations.social.base import upsert_account


# ─── OAuth orchestration ────────────────────────────────────────────────────

def build_oauth_url(tenant_id: uuid.UUID, platform: str) -> tuple[str, str]:
    """Return (auth_url, state) for the given platform, or raise ValueError."""
    connector = get_connector(platform)
    if connector is None:
        raise ValueError(f"Unknown platform: {platform}")
    if not connector.is_configured():
        raise ValueError(f"{platform} OAuth is not configured on this server")
    state = oauth_state.issue(tenant_id, platform)
    return connector.build_auth_url(state), state


def pop_oauth_state(state: str) -> dict[str, Any] | None:
    return oauth_state.pop(state)


# Back-compat alias — `build_meta_oauth_url` used to be called directly.
def build_meta_oauth_url(tenant_id: uuid.UUID) -> tuple[str, str]:
    return build_oauth_url(tenant_id, "facebook")


async def handle_oauth_callback(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    platform: str,
    code: str,
    state: str | None = None,
) -> list[SocialAccount]:
    """Exchange an auth code via the platform's connector and upsert accounts.

    ``state`` is forwarded to connectors that need it (e.g. X's PKCE verifier
    lookup). Connectors that don't accept it fall back cleanly.
    """
    connector = get_connector(platform)
    if connector is None:
        raise ValueError(f"Unknown platform: {platform}")

    try:
        bundle = await connector.exchange_code(code, state=state)  # type: ignore[call-arg]
    except TypeError:
        bundle = await connector.exchange_code(code)
    stored: list[SocialAccount] = []
    for spec in bundle.accounts:
        acct = await upsert_account(
            db,
            tenant_id=tenant_id,
            platform=spec["platform"],
            account_id=spec["account_id"],
            name=spec["name"],
            access_token=spec["access_token"],
            refresh_token=bundle.refresh_token,
            expires_at=bundle.expires_at,
        )
        stored.append(acct)
    await db.flush()
    return stored


# Back-compat alias for Meta-specific callback
async def handle_meta_callback(
    db: AsyncSession, tenant_id: uuid.UUID, code: str
) -> list[SocialAccount]:
    return await handle_oauth_callback(db, tenant_id, "facebook", code)


# ─── Account CRUD ───────────────────────────────────────────────────────────

def _to_account_response(acct: SocialAccount) -> dict[str, Any]:
    return {
        "id": acct.id,
        "platform": acct.platform.value if hasattr(acct.platform, "value") else str(acct.platform),
        "page_name": acct.name,
        "page_id": acct.account_id,
        "connected_at": acct.created_at,
        "expires_at": getattr(acct, "token_expires_at", None),
    }


async def list_accounts(db: AsyncSession, tenant_id: uuid.UUID) -> list[dict[str, Any]]:
    result = await db.execute(
        select(SocialAccount)
        .where(SocialAccount.tenant_id == tenant_id)
        .order_by(SocialAccount.created_at.desc())
    )
    return [_to_account_response(a) for a in result.scalars().all()]


async def disconnect_account(
    db: AsyncSession, tenant_id: uuid.UUID, account_id: uuid.UUID
) -> bool:
    result = await db.execute(
        select(SocialAccount).where(
            SocialAccount.id == account_id, SocialAccount.tenant_id == tenant_id
        )
    )
    acct = result.scalar_one_or_none()
    if not acct:
        return False
    await db.delete(acct)
    await db.flush()
    return True


# ─── Scheduled posts ────────────────────────────────────────────────────────

async def schedule_post(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    platforms: list[str],
    scheduled_at: datetime,
    caption: str,
    media_urls: list[str],
    content_post_id: uuid.UUID | None = None,
    publish_mode: str = "auto",
) -> list[SocialPost]:
    """Create one SocialPost row per platform.

    - ``auto`` mode requires a connected SocialAccount for each platform; the
      Celery worker will publish at ``scheduled_at``.
    - ``manual`` mode can schedule reminders even without a connected account
      (``social_account_id`` is nullable as of migration n4i5j6k7l8m9).
    """
    accs_result = await db.execute(
        select(SocialAccount).where(
            SocialAccount.tenant_id == tenant_id, SocialAccount.is_active == True  # noqa: E712
        )
    )
    accounts = accs_result.scalars().all()
    by_platform: dict[str, SocialAccount] = {}
    for a in accounts:
        plat = a.platform.value if hasattr(a.platform, "value") else str(a.platform)
        by_platform.setdefault(plat, a)

    created: list[SocialPost] = []
    for plat in platforms:
        acct = by_platform.get(plat)
        if not acct and publish_mode == "auto":
            # Auto-publish needs a real account; skip platforms that aren't connected.
            continue

        # Normalize platform string to SocialPlatform enum value when possible.
        from app.db.models import SocialPlatform
        try:
            platform_enum = SocialPlatform(plat)
        except ValueError:
            platform_enum = None

        post = SocialPost(
            tenant_id=tenant_id,
            social_account_id=acct.id if acct else None,
            platform=platform_enum,
            content_post_id=content_post_id,
            content=caption,
            media_urls=media_urls or [],
            status=SocialPostStatus.scheduled,
            scheduled_at=scheduled_at,
            publish_mode=publish_mode,
        )
        db.add(post)
        created.append(post)
    await db.flush()
    return created


async def mark_published(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    post_id: uuid.UUID,
    external_url: str | None = None,
) -> SocialPost | None:
    result = await db.execute(
        select(SocialPost).where(
            SocialPost.id == post_id, SocialPost.tenant_id == tenant_id
        )
    )
    post = result.scalar_one_or_none()
    if not post:
        return None
    post.status = SocialPostStatus.published
    post.published_at = datetime.now(timezone.utc)
    if external_url:
        post.external_post_id = external_url[:255]
    await db.flush()
    return post


def _post_to_response(post: SocialPost, account: SocialAccount | None) -> dict[str, Any]:
    platform = "unknown"
    if account is not None:
        platform = account.platform.value if hasattr(account.platform, "value") else str(account.platform)
    status = post.status.value if hasattr(post.status, "value") else str(post.status)
    return {
        "id": post.id,
        "platform": platform,
        "scheduled_at": post.scheduled_at,
        "status": status,
        "caption": post.content,
        "media_urls": post.media_urls or [],
        "external_id": post.external_post_id,
        "error": None,
        "content_post_id": post.content_post_id,
        "content_post_title": None,
        "publish_mode": post.publish_mode or "auto",
    }


async def list_scheduled(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> list[dict[str, Any]]:
    query = select(SocialPost).where(SocialPost.tenant_id == tenant_id)
    if date_from is not None:
        query = query.where(SocialPost.scheduled_at >= date_from)
    if date_to is not None:
        query = query.where(SocialPost.scheduled_at <= date_to)
    query = query.order_by(SocialPost.scheduled_at.asc().nulls_last())
    posts = (await db.execute(query)).scalars().all()

    acct_ids = {p.social_account_id for p in posts}
    accts: dict[uuid.UUID, SocialAccount] = {}
    if acct_ids:
        acc_rows = (
            await db.execute(select(SocialAccount).where(SocialAccount.id.in_(acct_ids)))
        ).scalars().all()
        accts = {a.id: a for a in acc_rows}

    content_ids = {p.content_post_id for p in posts if p.content_post_id}
    titles: dict[uuid.UUID, str] = {}
    if content_ids:
        cp_rows = (
            await db.execute(
                select(ContentPost.id, ContentPost.title).where(ContentPost.id.in_(content_ids))
            )
        ).all()
        titles = {row[0]: row[1] for row in cp_rows}

    out: list[dict[str, Any]] = []
    for p in posts:
        item = _post_to_response(p, accts.get(p.social_account_id))
        if p.content_post_id and p.content_post_id in titles:
            item["content_post_title"] = titles[p.content_post_id]
        out.append(item)
    return out


async def cancel_scheduled(
    db: AsyncSession, tenant_id: uuid.UUID, post_id: uuid.UUID
) -> bool:
    result = await db.execute(
        select(SocialPost).where(SocialPost.id == post_id, SocialPost.tenant_id == tenant_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        return False
    if post.status == SocialPostStatus.published:
        return False
    await db.delete(post)
    await db.flush()
    return True


def suggest_best_times(tenant_id: uuid.UUID) -> list[dict[str, Any]]:
    """Heuristic defaults. Swap in analytics-driven suggestions later."""
    days = ["mon", "wed", "fri"]
    hours = [9, 12, 19]
    scores = {9: 0.78, 12: 0.85, 19: 0.92}
    out: list[dict[str, Any]] = []
    for day in days:
        for hour in hours:
            out.append({"day": day, "hour": hour, "score": scores[hour]})
    return out
