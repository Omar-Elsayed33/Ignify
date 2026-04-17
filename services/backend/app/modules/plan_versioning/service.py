"""Plan version snapshotting — called from plans.service before destructive ops.

Call `snapshot_plan(db, plan, reason, user_id)` immediately BEFORE running a
regeneration (full or section). The snapshot captures the plan's state at that
moment; rolling back copies `payload` fields back onto the plan.
"""
from __future__ import annotations

import uuid
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import MarketingPlan, MarketingPlanSnapshot

# Fields that ARE stored on the MarketingPlan table and carried over on rollback.
_SNAPSHOT_FIELDS: tuple[str, ...] = (
    "title",
    "goals",
    "personas",
    "channels",
    "calendar",
    "kpis",
    "market_analysis",
    "ad_strategy",
    "positioning",
    "customer_journey",
    "offer",
    "funnel",
    "conversion",
    "retention",
    "growth_loops",
    "execution_roadmap",
    "primary_goal",
    "plan_mode",
    "status",
    "version",
)


def _serialize_plan(plan: MarketingPlan) -> dict[str, Any]:
    return {k: getattr(plan, k, None) for k in _SNAPSHOT_FIELDS}


async def snapshot_plan(
    db: AsyncSession,
    plan: MarketingPlan,
    *,
    reason: str,
    user_id: Optional[uuid.UUID] = None,
) -> MarketingPlanSnapshot:
    snap = MarketingPlanSnapshot(
        plan_id=plan.id,
        tenant_id=plan.tenant_id,
        version=plan.version,
        payload=_serialize_plan(plan),
        reason=reason[:255],
        created_by=user_id,
    )
    db.add(snap)
    await db.flush()
    return snap


async def list_snapshots(
    db: AsyncSession, *, tenant_id: uuid.UUID, plan_id: uuid.UUID
) -> list[MarketingPlanSnapshot]:
    result = await db.execute(
        select(MarketingPlanSnapshot)
        .where(
            MarketingPlanSnapshot.plan_id == plan_id,
            MarketingPlanSnapshot.tenant_id == tenant_id,
        )
        .order_by(MarketingPlanSnapshot.created_at.desc())
    )
    return list(result.scalars().all())


async def get_snapshot(
    db: AsyncSession, *, tenant_id: uuid.UUID, snapshot_id: uuid.UUID
) -> Optional[MarketingPlanSnapshot]:
    result = await db.execute(
        select(MarketingPlanSnapshot).where(
            MarketingPlanSnapshot.id == snapshot_id,
            MarketingPlanSnapshot.tenant_id == tenant_id,
        )
    )
    return result.scalar_one_or_none()


async def rollback_to_snapshot(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    plan_id: uuid.UUID,
    snapshot_id: uuid.UUID,
    user_id: Optional[uuid.UUID] = None,
) -> MarketingPlan:
    snap = await get_snapshot(db, tenant_id=tenant_id, snapshot_id=snapshot_id)
    if not snap or snap.plan_id != plan_id:
        raise ValueError("snapshot_not_found")

    plan_result = await db.execute(
        select(MarketingPlan).where(
            MarketingPlan.id == plan_id, MarketingPlan.tenant_id == tenant_id
        )
    )
    plan = plan_result.scalar_one_or_none()
    if not plan:
        raise ValueError("plan_not_found")

    # Before rolling back, snapshot the CURRENT state so rollbacks are themselves reversible.
    await snapshot_plan(db, plan, reason=f"rollback to v{snap.version}", user_id=user_id)

    # Restore all tracked fields from the snapshot payload.
    for key in _SNAPSHOT_FIELDS:
        if key in snap.payload:
            setattr(plan, key, snap.payload[key])
    # Bump version so callers/UI detect the change.
    plan.version = (plan.version or 1) + 1
    await db.flush()
    return plan
