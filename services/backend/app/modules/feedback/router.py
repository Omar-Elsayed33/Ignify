"""Lightweight feedback collection — NPS scores + cancellation reasons.

Persisted to the existing `audit_logs` table to avoid a migration. Telemetry-grade,
not a full analytics pipeline. Export to a BI tool later by filtering on `action`.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.db.models import AuditLog
from app.dependencies import CurrentUser, DbSession

router = APIRouter(prefix="/feedback", tags=["feedback"])


class NPSRequest(BaseModel):
    score: int = Field(ge=0, le=10)
    note: Optional[str] = None


class CancellationReasonRequest(BaseModel):
    reason: str  # picked option: too_expensive | not_using | found_alternative | missing_features | other
    note: Optional[str] = None


@router.post("/nps", status_code=204)
async def submit_nps(data: NPSRequest, user: CurrentUser, db: DbSession):
    entry = AuditLog(
        tenant_id=user.tenant_id,
        user_id=user.id,
        action="feedback.nps",
        resource_type="user",
        resource_id=str(user.id),
        details={"score": data.score, "note": (data.note or "")[:2000]},
    )
    db.add(entry)
    await db.flush()
    return


@router.post("/cancellation-reason", status_code=204)
async def submit_cancellation_reason(
    data: CancellationReasonRequest, user: CurrentUser, db: DbSession
):
    entry = AuditLog(
        tenant_id=user.tenant_id,
        user_id=user.id,
        action="feedback.cancellation_reason",
        resource_type="subscription",
        resource_id=None,
        details={"reason": data.reason[:100], "note": (data.note or "")[:2000]},
    )
    db.add(entry)
    await db.flush()
    return
