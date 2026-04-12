"""Social scheduler router: OAuth, scheduling, calendar."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import RedirectResponse

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


@router.get("/oauth/meta/start", response_model=OAuthStartResponse)
async def oauth_meta_start(user: CurrentUser):
    url, state = service.build_meta_oauth_url(user.tenant_id)
    return OAuthStartResponse(url=url, state=state)


@router.get("/oauth/meta/callback")
async def oauth_meta_callback(code: str, state: str):
    """Meta redirects here; use state to resolve tenant (no auth header)."""
    bound = service.pop_oauth_state(state)
    if not bound:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired state")
    tenant_id = uuid.UUID(bound["tenant_id"])
    async with async_session() as db:
        try:
            await service.handle_meta_callback(db, tenant_id, code)
            await db.commit()
        except Exception as exc:  # noqa: BLE001
            await db.rollback()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"OAuth callback failed: {exc}") from exc
    # Redirect back to dashboard accounts page
    return RedirectResponse(url="http://localhost:3000/en/scheduler/accounts?connected=1")


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
    )
    if not posts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No connected accounts match the requested platforms",
        )
    created_ids = {p.id for p in posts}
    all_scheduled = await service.list_scheduled(db, user.tenant_id)
    return [p for p in all_scheduled if p["id"] in created_ids]


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
