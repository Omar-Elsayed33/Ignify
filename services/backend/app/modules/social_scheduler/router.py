"""Social scheduler router: OAuth, scheduling, calendar."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from app.db.database import async_session
from app.dependencies import CurrentUser, DbSession
from app.modules.social_scheduler import service
from app.modules.social_scheduler.schemas import (
    BestTimesResponse,
    OAuthStartResponse,
    ScheduledPostResponse,
    SchedulePostRequest,
    SocialAccountResponse,
)

router = APIRouter(prefix="/social-scheduler", tags=["social-scheduler"])


_OAUTH_PLATFORM_ALIASES = {
    "meta": "facebook",  # /oauth/meta/* kept for back-compat
    "facebook": "facebook",
    "instagram": "facebook",  # IG is acquired via the same Meta OAuth
    "linkedin": "linkedin",
    "x": "twitter",
    "twitter": "twitter",
    "youtube": "youtube",
    "tiktok": "tiktok",
    "snapchat": "snapchat",
}


@router.get("/connectors")
async def list_connectors():
    """Expose which platform connectors are present + whether their OAuth is
    configured on this server. Used by the frontend to show/hide Connect buttons."""
    from app.integrations.social import iter_connectors

    out = []
    for platform, connector in iter_connectors():
        out.append({
            "platform": platform.value,
            "configured": connector.is_configured(),
            "requires_media": getattr(connector, "requires_media", False),
            "supports_refresh": getattr(connector, "supports_refresh", False),
        })
    return {"connectors": out}


@router.get("/oauth/{platform}/start", response_model=OAuthStartResponse)
async def oauth_start(platform: str, user: CurrentUser):
    target = _OAUTH_PLATFORM_ALIASES.get(platform, platform)
    try:
        url, state = service.build_oauth_url(user.tenant_id, target)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return OAuthStartResponse(url=url, state=state)


@router.get("/oauth/{platform}/callback")
async def oauth_callback(platform: str, code: str, state: str):
    """Third-party redirects here; `state` resolves the tenant (no auth header)."""
    target = _OAUTH_PLATFORM_ALIASES.get(platform, platform)
    bound = service.pop_oauth_state(state)
    if not bound:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired state")
    tenant_id = uuid.UUID(bound["tenant_id"])
    async with async_session() as db:
        try:
            await service.handle_oauth_callback(db, tenant_id, target, code, state=state)
            await db.commit()
        except Exception as exc:  # noqa: BLE001
            await db.rollback()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"OAuth callback failed: {exc}") from exc
    return RedirectResponse(url=f"http://localhost:3000/ar/settings/channels?connected={target}")


@router.get("/accounts", response_model=list[SocialAccountResponse])
async def list_accounts(user: CurrentUser, db: DbSession):
    return await service.list_accounts(db, user.tenant_id)


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_account(account_id: uuid.UUID, user: CurrentUser, db: DbSession):
    ok = await service.disconnect_account(db, user.tenant_id, account_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")


@router.post("/schedule", response_model=list[ScheduledPostResponse], status_code=status.HTTP_201_CREATED)
async def schedule_post(data: SchedulePostRequest, user: CurrentUser, db: DbSession):
    posts = await service.schedule_post(
        db,
        user.tenant_id,
        platforms=data.platforms,
        scheduled_at=data.scheduled_at,
        caption=data.caption,
        media_urls=data.media_urls,
        content_post_id=data.content_post_id,
        publish_mode=data.publish_mode,
    )
    if not posts:
        detail = (
            "Manual scheduling still requires at least one connected platform on your tenant — "
            "connect any social account once and you can then schedule manual posts for any platform."
            if data.publish_mode == "manual"
            else "No connected accounts match the requested platforms"
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
    created_ids = {p.id for p in posts}
    all_scheduled = await service.list_scheduled(db, user.tenant_id)
    return [p for p in all_scheduled if p["id"] in created_ids]


class _MarkPublishedBody(BaseModel):
    external_url: str | None = None


@router.post("/scheduled/{post_id}/mark-published", response_model=ScheduledPostResponse)
async def mark_published(
    post_id: uuid.UUID,
    data: _MarkPublishedBody,
    user: CurrentUser,
    db: DbSession,
):
    post = await service.mark_published(db, user.tenant_id, post_id, data.external_url)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheduled post not found")
    all_scheduled = await service.list_scheduled(db, user.tenant_id)
    for p in all_scheduled:
        if p["id"] == post_id:
            return p
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheduled post not found")


@router.get("/scheduled", response_model=list[ScheduledPostResponse])
async def list_scheduled(
    user: CurrentUser,
    db: DbSession,
    date_from: datetime | None = Query(default=None, alias="from"),
    date_to: datetime | None = Query(default=None, alias="to"),
):
    return await service.list_scheduled(db, user.tenant_id, date_from, date_to)


@router.delete("/scheduled/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_scheduled(post_id: uuid.UUID, user: CurrentUser, db: DbSession):
    ok = await service.cancel_scheduled(db, user.tenant_id, post_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheduled post not found or already published")


@router.get("/best-times", response_model=BestTimesResponse)
async def best_times(user: CurrentUser):
    return BestTimesResponse(suggestions=service.suggest_best_times(user.tenant_id))
