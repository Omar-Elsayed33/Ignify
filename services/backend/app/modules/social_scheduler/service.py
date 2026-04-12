"""Social scheduler service: Meta OAuth, scheduled posts, suggestions."""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import httpx
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import SocialAccount, SocialPlatform, SocialPost, SocialPostStatus

META_SCOPES = [
    "pages_show_list",
    "pages_manage_posts",
    "pages_read_engagement",
    "instagram_basic",
    "instagram_content_publish",
    "ads_management",
    "ads_read",
    "business_management",
]


# In-memory state store for OAuth (tenant binding); swap for Redis in prod
_oauth_states: dict[str, dict[str, Any]] = {}


def build_meta_oauth_url(tenant_id: uuid.UUID) -> tuple[str, str]:
    state = secrets.token_urlsafe(32)
    _oauth_states[state] = {
        "tenant_id": str(tenant_id),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    params = {
        "client_id": settings.META_APP_ID,
        "redirect_uri": settings.META_REDIRECT_URI,
        "state": state,
        "scope": ",".join(META_SCOPES),
        "response_type": "code",
    }
    url = f"https://www.facebook.com/v19.0/dialog/oauth?{urlencode(params)}"
    return url, state


def pop_oauth_state(state: str) -> dict[str, Any] | None:
    return _oauth_states.pop(state, None)


async def handle_meta_callback(
    db: AsyncSession, tenant_id: uuid.UUID, code: str
) -> list[SocialAccount]:
    """Exchange OAuth code for long-lived token, fetch pages, store accounts."""
    async with httpx.AsyncClient(timeout=20.0) as client:
        # 1) Exchange code for short-lived user token
        token_resp = await client.get(
            "https://graph.facebook.com/v19.0/oauth/access_token",
            params={
                "client_id": settings.META_APP_ID,
                "client_secret": settings.META_APP_SECRET,
                "redirect_uri": settings.META_REDIRECT_URI,
                "code": code,
            },
        )
        token_resp.raise_for_status()
        short_token = token_resp.json().get("access_token")

        # 2) Upgrade to long-lived user token
        long_resp = await client.get(
            "https://graph.facebook.com/v19.0/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": settings.META_APP_ID,
                "client_secret": settings.META_APP_SECRET,
                "fb_exchange_token": short_token,
            },
        )
        long_resp.raise_for_status()
        long_data = long_resp.json()
        long_token = long_data.get("access_token")
        expires_in = long_data.get("expires_in")  # seconds

        # 3) Fetch pages the user manages
        pages_resp = await client.get(
            "https://graph.facebook.com/v19.0/me/accounts",
            params={"access_token": long_token, "fields": "id,name,access_token,instagram_business_account"},
        )
        pages_resp.raise_for_status()
        pages = pages_resp.json().get("data", [])

    stored: list[SocialAccount] = []
    now = datetime.now(timezone.utc)
    for page in pages:
        page_id = page["id"]
        page_name = page.get("name") or page_id
        page_token = page.get("access_token") or long_token

        # Facebook page
        fb_acct = await _upsert_account(
            db,
            tenant_id=tenant_id,
            platform=SocialPlatform.facebook,
            account_id=page_id,
            name=page_name,
            access_token=page_token,
        )
        stored.append(fb_acct)

        # Instagram business account linked to page
        ig = page.get("instagram_business_account") or {}
        ig_id = ig.get("id")
        if ig_id:
            ig_acct = await _upsert_account(
                db,
                tenant_id=tenant_id,
                platform=SocialPlatform.instagram,
                account_id=ig_id,
                name=f"{page_name} (IG)",
                access_token=page_token,
            )
            stored.append(ig_acct)

    await db.flush()
    return stored


async def _upsert_account(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    platform: SocialPlatform,
    account_id: str,
    name: str,
    access_token: str,
) -> SocialAccount:
    result = await db.execute(
        select(SocialAccount).where(
            and_(
                SocialAccount.tenant_id == tenant_id,
                SocialAccount.platform == platform,
                SocialAccount.account_id == account_id,
            )
        )
    )
    acct = result.scalar_one_or_none()
    if acct:
        acct.name = name
        acct.access_token_encrypted = access_token
        acct.is_active = True
    else:
        acct = SocialAccount(
            tenant_id=tenant_id,
            platform=platform,
            account_id=account_id,
            name=name,
            access_token_encrypted=access_token,
            is_active=True,
        )
        db.add(acct)
    return acct


def _to_account_response(acct: SocialAccount) -> dict[str, Any]:
    return {
        "id": acct.id,
        "platform": acct.platform.value if hasattr(acct.platform, "value") else str(acct.platform),
        "page_name": acct.name,
        "page_id": acct.account_id,
        "connected_at": acct.created_at,
        "expires_at": None,
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


async def schedule_post(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    platforms: list[str],
    scheduled_at: datetime,
    caption: str,
    media_urls: list[str],
    content_post_id: uuid.UUID | None = None,
) -> list[SocialPost]:
    """Create one SocialPost row per platform (with a matching SocialAccount)."""
    # Resolve tenant accounts once
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
        if not acct:
            # Skip silently; caller may have requested a platform not connected
            continue
        post = SocialPost(
            tenant_id=tenant_id,
            social_account_id=acct.id,
            content=caption,
            media_urls=media_urls or [],
            status=SocialPostStatus.scheduled,
            scheduled_at=scheduled_at,
        )
        db.add(post)
        created.append(post)
    await db.flush()
    return created


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

    # Fetch accounts for platform resolution
    acct_ids = {p.social_account_id for p in posts}
    accts: dict[uuid.UUID, SocialAccount] = {}
    if acct_ids:
        acc_rows = (
            await db.execute(select(SocialAccount).where(SocialAccount.id.in_(acct_ids)))
        ).scalars().all()
        accts = {a.id: a for a in acc_rows}

    return [_post_to_response(p, accts.get(p.social_account_id)) for p in posts]


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
