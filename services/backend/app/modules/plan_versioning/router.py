"""Plan version history endpoints — list, view, rollback."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status

from app.dependencies import CurrentUser, DbSession

from . import service

router = APIRouter(prefix="/plans", tags=["plan-versioning"])


def _serialize(snap) -> dict:
    return {
        "id": str(snap.id),
        "plan_id": str(snap.plan_id),
        "version": snap.version,
        "reason": snap.reason,
        "created_by": str(snap.created_by) if snap.created_by else None,
        "created_at": snap.created_at.isoformat() if snap.created_at else None,
        "payload_keys": list((snap.payload or {}).keys()),
    }


@router.get("/{plan_id}/versions")
async def list_versions(plan_id: uuid.UUID, user: CurrentUser, db: DbSession):
    snaps = await service.list_snapshots(db, tenant_id=user.tenant_id, plan_id=plan_id)
    return [_serialize(s) for s in snaps]


@router.get("/{plan_id}/versions/{snapshot_id}")
async def get_version(
    plan_id: uuid.UUID,
    snapshot_id: uuid.UUID,
    user: CurrentUser,
    db: DbSession,
):
    snap = await service.get_snapshot(db, tenant_id=user.tenant_id, snapshot_id=snapshot_id)
    if not snap or snap.plan_id != plan_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="snapshot_not_found")
    return {**_serialize(snap), "payload": snap.payload}


@router.post("/{plan_id}/versions/{snapshot_id}/rollback")
async def rollback_version(
    plan_id: uuid.UUID,
    snapshot_id: uuid.UUID,
    user: CurrentUser,
    db: DbSession,
):
    if user.role not in {"owner", "admin", "superadmin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")
    try:
        plan = await service.rollback_to_snapshot(
            db,
            tenant_id=user.tenant_id,
            plan_id=plan_id,
            snapshot_id=snapshot_id,
            user_id=user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return {"id": str(plan.id), "version": plan.version, "status": plan.status}
