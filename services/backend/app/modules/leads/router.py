from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.rate_limit_presets import LOOSE, MEDIUM, STRICT
from app.db.models import LeadPipelineStage
from app.dependencies import CurrentUser, DbSession
from app.modules.leads import service as leads_service
from app.modules.leads.schemas import (
    LeadActivityCreate,
    LeadActivityResponse,
    LeadCreate,
    LeadKanbanColumn,
    LeadMoveStage,
    LeadQualifyResponse,
    LeadResponse,
    LeadUpdate,
    PipelineStageCreate,
    PipelineStageResponse,
)

router = APIRouter(prefix="/leads", tags=["leads"])


# ── Kanban ──


@router.get("/kanban", response_model=list[LeadKanbanColumn])
async def kanban(user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenant")
    return await leads_service.list_by_stage(db, user.tenant_id)


# ── Leads CRUD ──


@router.get("/", response_model=list[LeadResponse])
async def list_leads(
    user: CurrentUser,
    db: DbSession,
    status_filter: str | None = None,
    source_filter: str | None = None,
    skip: int = 0,
    limit: int = 200,
):
    from app.db.models import Lead

    query = select(Lead).where(Lead.tenant_id == user.tenant_id)
    if status_filter:
        query = query.where(Lead.status == status_filter)
    if source_filter:
        query = query.where(Lead.source == source_filter)
    query = query.order_by(Lead.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    leads = list(result.scalars().all())
    counts = await leads_service._activity_counts(db, [l.id for l in leads])
    return [leads_service._to_response(l, counts.get(l.id, 0)) for l in leads]


@router.post(
    "/",
    response_model=LeadResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[MEDIUM],
)
async def create_lead(data: LeadCreate, user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenant")
    lead = await leads_service.create_lead(db, user.tenant_id, data)
    return leads_service._to_response(lead, 0)


@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead(lead_id: uuid.UUID, user: CurrentUser, db: DbSession):
    lead = await leads_service.get_lead(db, user.tenant_id, lead_id)
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    counts = await leads_service._activity_counts(db, [lead.id])
    return leads_service._to_response(lead, counts.get(lead.id, 0))


@router.patch("/{lead_id}", response_model=LeadResponse, dependencies=[MEDIUM])
async def update_lead(
    lead_id: uuid.UUID, data: LeadUpdate, user: CurrentUser, db: DbSession
):
    lead = await leads_service.update_lead(db, user.tenant_id, lead_id, data)
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    counts = await leads_service._activity_counts(db, [lead.id])
    return leads_service._to_response(lead, counts.get(lead.id, 0))


@router.put("/{lead_id}", response_model=LeadResponse, dependencies=[MEDIUM])
async def put_lead(
    lead_id: uuid.UUID, data: LeadUpdate, user: CurrentUser, db: DbSession
):
    # PUT kept for backward-compat with existing dashboard calls
    return await update_lead(lead_id, data, user, db)


@router.post("/{lead_id}/move", response_model=LeadResponse, dependencies=[LOOSE])
async def move_lead_stage(
    lead_id: uuid.UUID, data: LeadMoveStage, user: CurrentUser, db: DbSession
):
    lead = await leads_service.move_stage(db, user.tenant_id, lead_id, data.stage)
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    counts = await leads_service._activity_counts(db, [lead.id])
    return leads_service._to_response(lead, counts.get(lead.id, 0))


@router.delete(
    "/{lead_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[MEDIUM],
)
async def delete_lead(lead_id: uuid.UUID, user: CurrentUser, db: DbSession):
    ok = await leads_service.delete_lead(db, user.tenant_id, lead_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")


# ── Qualification (AI) ──


@router.post(
    "/{lead_id}/qualify",
    response_model=LeadQualifyResponse,
    dependencies=[STRICT],
)
async def qualify(lead_id: uuid.UUID, user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenant")
    try:
        result = await leads_service.qualify_lead(db, user.tenant_id, lead_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Qualification failed: {e}")
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return LeadQualifyResponse(**result)


# ── Activities ──


@router.get("/{lead_id}/activities", response_model=list[LeadActivityResponse])
async def list_lead_activities(lead_id: uuid.UUID, user: CurrentUser, db: DbSession):
    # Require lead exists for tenant
    lead = await leads_service.get_lead(db, user.tenant_id, lead_id)
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return await leads_service.list_activities(db, user.tenant_id, lead_id)


@router.post(
    "/{lead_id}/activities",
    response_model=LeadActivityResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[LOOSE],
)
async def add_lead_activity(
    lead_id: uuid.UUID,
    data: LeadActivityCreate,
    user: CurrentUser,
    db: DbSession,
):
    activity = await leads_service.add_activity(
        db, user.tenant_id, lead_id, data, created_by=user.id
    )
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return activity


# Legacy endpoint (kept)
@router.post(
    "/activities",
    response_model=LeadActivityResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[LOOSE],
)
async def create_lead_activity_legacy(
    data: LeadActivityCreate, user: CurrentUser, db: DbSession
):
    if not data.lead_id:
        raise HTTPException(status_code=400, detail="lead_id required")
    activity = await leads_service.add_activity(
        db, user.tenant_id, data.lead_id, data, created_by=user.id
    )
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return activity


# ── Pipeline stages (custom) ──


@router.get("/pipeline/stages", response_model=list[PipelineStageResponse])
async def list_pipeline_stages(user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(LeadPipelineStage)
        .where(LeadPipelineStage.tenant_id == user.tenant_id)
        .order_by(LeadPipelineStage.order_index)
    )
    return result.scalars().all()


@router.post(
    "/pipeline/stages",
    response_model=PipelineStageResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[MEDIUM],
)
async def create_pipeline_stage(
    data: PipelineStageCreate, user: CurrentUser, db: DbSession
):
    stage = LeadPipelineStage(
        tenant_id=user.tenant_id,
        name=data.name,
        order_index=data.order_index,
        color=data.color,
    )
    db.add(stage)
    await db.flush()
    await db.commit()
    await db.refresh(stage)
    return stage
