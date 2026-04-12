"""Plan-based feature gating and usage quota enforcement."""
from __future__ import annotations

from typing import Annotated, Callable

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import Plan, Tenant, User
from app.dependencies import get_current_user
from app.modules.billing.service import check_quota as _check_quota


def _extract_features(plan: Plan | None) -> list[str]:
    if plan is None:
        return []
    f = plan.features or {}
    if isinstance(f, list):
        return [str(x) for x in f]
    if isinstance(f, dict):
        feats = f.get("features", [])
        if isinstance(feats, list):
            return [str(x) for x in feats]
    return []


def require_feature(feature: str) -> Callable:
    """FastAPI dependency factory — raises 402 if tenant's plan lacks feature."""

    async def _check(
        user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> User:
        if not user.tenant_id:
            raise HTTPException(status_code=403, detail="No tenant")
        tenant = (
            await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
        ).scalar_one_or_none()
        if not tenant or not tenant.plan_id:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={"error": "no_plan", "feature": feature},
            )
        plan = (
            await db.execute(select(Plan).where(Plan.id == tenant.plan_id))
        ).scalar_one_or_none()
        if feature not in _extract_features(plan):
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={
                    "error": "feature_not_available",
                    "feature": feature,
                    "message": f"Feature '{feature}' requires a plan upgrade.",
                },
            )
        return user

    return _check


def enforce_quota(resource: str, amount: int = 1) -> Callable:
    """FastAPI dependency factory — raises 402 if usage exceeds plan quota."""

    async def _check(
        user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> User:
        if not user.tenant_id:
            raise HTTPException(status_code=403, detail="No tenant")
        await _check_quota(db, user.tenant_id, resource, amount)
        return user

    return _check
