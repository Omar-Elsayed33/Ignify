import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.db.models import Lead, LeadActivity, LeadPipelineStage
from app.dependencies import CurrentUser, DbSession
from app.modules.leads.schemas import (
    LeadActivityCreate,
    LeadActivityResponse,
    LeadCreate,
    LeadResponse,
    LeadUpdate,
    PipelineStageCreate,
    PipelineStageResponse,
)

router = APIRouter(prefix="/leads", tags=["leads"])


# ── Leads ──


@router.get("/", response_model=list[LeadResponse])
async def list_leads(
    user: CurrentUser,
    db: DbSession,
    status_filter: str | None = None,
    source_filter: str | None = None,
    skip: int = 0,
    limit: int = 50,
):
    query = select(Lead).where(Lead.tenant_id == user.tenant_id)
    if status_filter:
        query = query.where(Lead.status == status_filter)
    if source_filter:
        query = query.where(Lead.source == source_filter)
    query = query.order_by(Lead.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def create_lead(data: LeadCreate, user: CurrentUser, db: DbSession):
    lead = Lead(
        tenant_id=user.tenant_id,
        name=data.name,
        email=data.email,
        phone=data.phone,
        company=data.company,
        source=data.source,
        score=data.score,
        status=data.status,
        assigned_to=data.assigned_to,
        metadata_=data.metadata or {},
    )
    db.add(lead)
    await db.flush()
    return lead


@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead(lead_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.tenant_id == user.tenant_id)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return lead


@router.put("/{lead_id}", response_model=LeadResponse)
async def update_lead(lead_id: uuid.UUID, data: LeadUpdate, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.tenant_id == user.tenant_id)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "metadata":
            setattr(lead, "metadata_", value)
        else:
            setattr(lead, field, value)
    await db.flush()
    return lead


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(lead_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.tenant_id == user.tenant_id)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    await db.delete(lead)
    await db.flush()


# ── Pipeline ──


@router.get("/pipeline/stages", response_model=list[PipelineStageResponse])
async def list_pipeline_stages(user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(LeadPipelineStage)
        .where(LeadPipelineStage.tenant_id == user.tenant_id)
        .order_by(LeadPipelineStage.order_index)
    )
    return result.scalars().all()


@router.post("/pipeline/stages", response_model=PipelineStageResponse, status_code=status.HTTP_201_CREATED)
async def create_pipeline_stage(data: PipelineStageCreate, user: CurrentUser, db: DbSession):
    stage = LeadPipelineStage(
        tenant_id=user.tenant_id,
        name=data.name,
        order_index=data.order_index,
        color=data.color,
    )
    db.add(stage)
    await db.flush()
    return stage


# ── Activities ──


@router.get("/{lead_id}/activities", response_model=list[LeadActivityResponse])
async def list_lead_activities(lead_id: uuid.UUID, user: CurrentUser, db: DbSession):
    lead_result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.tenant_id == user.tenant_id)
    )
    if not lead_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    result = await db.execute(
        select(LeadActivity).where(LeadActivity.lead_id == lead_id).order_by(LeadActivity.created_at.desc())
    )
    return result.scalars().all()


@router.post("/activities", response_model=LeadActivityResponse, status_code=status.HTTP_201_CREATED)
async def create_lead_activity(data: LeadActivityCreate, user: CurrentUser, db: DbSession):
    lead_result = await db.execute(
        select(Lead).where(Lead.id == data.lead_id, Lead.tenant_id == user.tenant_id)
    )
    if not lead_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    activity = LeadActivity(
        lead_id=data.lead_id,
        activity_type=data.activity_type,
        description=data.description,
        created_by=user.id,
    )
    db.add(activity)
    await db.flush()
    return activity
