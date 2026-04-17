"""Shareable read-only plan links — rotating tokens, optional expiry.

Two public endpoints (no auth): `GET /plans/public/{token}` to view.
Owner/admin can rotate or revoke the token at any time.
"""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.db.database import get_db
from app.db.models import MarketingPlan
from app.dependencies import CurrentUser, DbSession
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/plans", tags=["plan-share"])


class ShareResponse(BaseModel):
    share_token: str
    share_expires_at: Optional[datetime]
    share_url: str


class CreateShareRequest(BaseModel):
    expires_in_days: Optional[int] = 30  # default 30-day expiry; pass null for no expiry


def _share_url(token: str) -> str:
    # Frontend route — the dashboard serves the public view.
    from app.core.config import settings
    base = settings.FRONTEND_URL.rstrip("/")
    return f"{base}/plans/public/{token}"


@router.post("/{plan_id}/share", response_model=ShareResponse)
async def create_share_link(
    plan_id: uuid.UUID,
    data: CreateShareRequest,
    user: CurrentUser,
    db: DbSession,
):
    if user.role not in {"owner", "admin", "editor", "superadmin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")

    result = await db.execute(
        select(MarketingPlan).where(
            MarketingPlan.id == plan_id, MarketingPlan.tenant_id == user.tenant_id
        )
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="plan_not_found")

    # Always rotate (creates a fresh token; any prior link becomes invalid).
    token = "shr_" + secrets.token_urlsafe(24)
    plan.share_token = token
    plan.share_expires_at = (
        datetime.now(timezone.utc) + timedelta(days=data.expires_in_days)
        if data.expires_in_days
        else None
    )
    await db.flush()
    return ShareResponse(
        share_token=token,
        share_expires_at=plan.share_expires_at,
        share_url=_share_url(token),
    )


@router.delete("/{plan_id}/share", status_code=204)
async def revoke_share_link(
    plan_id: uuid.UUID, user: CurrentUser, db: DbSession
):
    if user.role not in {"owner", "admin", "editor", "superadmin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")

    result = await db.execute(
        select(MarketingPlan).where(
            MarketingPlan.id == plan_id, MarketingPlan.tenant_id == user.tenant_id
        )
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="plan_not_found")

    plan.share_token = None
    plan.share_expires_at = None
    await db.flush()
    return


# Public (no auth) read-only endpoint.
public_router = APIRouter(prefix="/plans/public", tags=["plan-share-public"])


@public_router.get("/{token}")
async def view_public_plan(token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MarketingPlan).where(MarketingPlan.share_token == token)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    if plan.share_expires_at and plan.share_expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="expired")

    # Return only the fields safe for public viewing — no tenant/user internals.
    return {
        "id": str(plan.id),
        "title": plan.title,
        "status": plan.status,
        "version": plan.version,
        "plan_mode": plan.plan_mode,
        "primary_goal": plan.primary_goal,
        "goals": plan.goals,
        "personas": plan.personas,
        "channels": plan.channels,
        "calendar": plan.calendar,
        "kpis": plan.kpis,
        "market_analysis": plan.market_analysis,
        "positioning": plan.positioning,
        "customer_journey": plan.customer_journey,
        "offer": plan.offer,
        "funnel": plan.funnel,
        "conversion": plan.conversion,
        "retention": plan.retention,
        "growth_loops": plan.growth_loops,
        "execution_roadmap": plan.execution_roadmap,
        "ad_strategy": plan.ad_strategy,
        "created_at": plan.created_at.isoformat() if plan.created_at else None,
        "updated_at": plan.updated_at.isoformat() if plan.updated_at else None,
    }
