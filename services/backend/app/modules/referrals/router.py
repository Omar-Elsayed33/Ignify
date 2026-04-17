"""Referral program — stable per-user code, signup capture, conversion tracking."""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import Referral, User
from app.dependencies import CurrentUser, DbSession
from fastapi import Depends

router = APIRouter(prefix="/referrals", tags=["referrals"])


class MyReferralResponse(BaseModel):
    code: str
    share_url: str
    total: int
    pending: int
    converted: int


class RedeemRequest(BaseModel):
    code: str


def _code_for_user(user_id: uuid.UUID) -> str:
    # 10-char URL-safe prefix from a fresh token (stable once created — the row stores it).
    return "R" + secrets.token_urlsafe(7).replace("-", "").replace("_", "")[:9].upper()


async def _ensure_referral_row(db: AsyncSession, user: User) -> Referral:
    """Get or create the stable Referral record for this user (referrer)."""
    # Each user has one 'seed' referral row used as the source for conversions.
    # For simplicity we look up by (referrer_user_id, code != NULL, referred_user_id IS NULL)
    # but actually the model treats every invitation as its own row; for the seed we scope
    # by referrer + no referred yet.
    result = await db.execute(
        select(Referral).where(
            Referral.referrer_user_id == user.id,
            Referral.referred_user_id.is_(None),
        ).limit(1)
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    row = Referral(
        referrer_user_id=user.id,
        referrer_tenant_id=user.tenant_id,
        code=_code_for_user(user.id),
        status="pending",
    )
    db.add(row)
    await db.flush()
    return row


def _share_url(code: str) -> str:
    from app.core.config import settings
    return f"{settings.FRONTEND_URL.rstrip('/')}/register?ref={code}"


@router.get("/me", response_model=MyReferralResponse)
async def get_my_referral(user: CurrentUser, db: DbSession):
    seed = await _ensure_referral_row(db, user)

    # Count all rows where this user is the referrer.
    total_res = await db.execute(
        select(func.count(Referral.id)).where(
            and_(
                Referral.referrer_user_id == user.id,
                Referral.referred_user_id.isnot(None),
            )
        )
    )
    total = int(total_res.scalar_one() or 0)

    converted_res = await db.execute(
        select(func.count(Referral.id)).where(
            and_(
                Referral.referrer_user_id == user.id,
                Referral.status == "converted",
            )
        )
    )
    converted = int(converted_res.scalar_one() or 0)
    pending = max(0, total - converted)

    return MyReferralResponse(
        code=seed.code,
        share_url=_share_url(seed.code),
        total=total,
        pending=pending,
        converted=converted,
    )


@router.post("/redeem", status_code=204)
async def redeem_referral(
    data: RedeemRequest, user: CurrentUser, db: DbSession
):
    """Call once shortly after a user's signup to attribute them to a referrer.
    No-op if the user already has an attribution or if the code is invalid/self-referral.
    """
    code = data.code.strip().upper()
    if not code:
        return

    # Can't self-refer
    existing_for_user = await db.execute(
        select(Referral).where(Referral.referred_user_id == user.id).limit(1)
    )
    if existing_for_user.scalar_one_or_none():
        return  # already attributed; silently no-op

    seed_res = await db.execute(
        select(Referral).where(Referral.code == code).limit(1)
    )
    seed = seed_res.scalar_one_or_none()
    if not seed or seed.referrer_user_id == user.id:
        return  # invalid or self-referral; silently no-op

    # Create a fresh attribution row.
    attribution = Referral(
        referrer_user_id=seed.referrer_user_id,
        referrer_tenant_id=seed.referrer_tenant_id,
        code=seed.code,
        referred_user_id=user.id,
        referred_tenant_id=user.tenant_id,
        status="pending",
    )
    db.add(attribution)
    await db.flush()
    return


@router.post("/{referral_id}/mark-converted", status_code=204)
async def mark_converted(
    referral_id: uuid.UUID, user: CurrentUser, db: DbSession
):
    """Mark a referral as converted. Call this from billing when the referred user upgrades.
    Restricted to owner/admin of the referrer's tenant OR to internal service calls.
    For now we allow any authenticated user from the referrer's tenant (owner/admin)."""
    if user.role not in {"owner", "admin", "superadmin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")

    result = await db.execute(select(Referral).where(Referral.id == referral_id))
    row = result.scalar_one_or_none()
    if not row or row.referrer_tenant_id != user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")

    row.status = "converted"
    row.converted_at = datetime.now(timezone.utc)
    row.reward = {"type": "one_month_free", "granted_at": row.converted_at.isoformat()}
    await db.flush()
    return
