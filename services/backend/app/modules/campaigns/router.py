import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.db.models import Campaign, CampaignAudience, CampaignStatus, CampaignStep
from app.dependencies import CurrentUser, DbSession
from app.modules.campaigns.schemas import (
    CampaignAudienceCreate,
    CampaignAudienceResponse,
    CampaignCreate,
    CampaignResponse,
    CampaignStepCreate,
    CampaignStepResponse,
    CampaignUpdate,
)

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("/", response_model=list[CampaignResponse])
async def list_campaigns(user: CurrentUser, db: DbSession, skip: int = 0, limit: int = 50):
    result = await db.execute(
        select(Campaign)
        .where(Campaign.tenant_id == user.tenant_id)
        .order_by(Campaign.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(data: CampaignCreate, user: CurrentUser, db: DbSession):
    campaign = Campaign(
        tenant_id=user.tenant_id,
        name=data.name,
        campaign_type=data.campaign_type,
        status=data.status,
        start_date=data.start_date,
        end_date=data.end_date,
        config=data.config or {},
    )
    db.add(campaign)
    await db.flush()
    return campaign


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(campaign_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == user.tenant_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return campaign


@router.put("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(campaign_id: uuid.UUID, data: CampaignUpdate, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == user.tenant_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(campaign, field, value)
    await db.flush()
    return campaign


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(campaign_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == user.tenant_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    await db.delete(campaign)
    await db.flush()


@router.post("/{campaign_id}/launch", response_model=CampaignResponse)
async def launch_campaign(campaign_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == user.tenant_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    if campaign.status != CampaignStatus.draft:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Campaign can only be launched from draft status")
    campaign.status = CampaignStatus.active
    await db.flush()
    return campaign


# ── Steps ──


@router.get("/{campaign_id}/steps", response_model=list[CampaignStepResponse])
async def list_steps(campaign_id: uuid.UUID, user: CurrentUser, db: DbSession):
    camp_result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == user.tenant_id)
    )
    if not camp_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    result = await db.execute(
        select(CampaignStep).where(CampaignStep.campaign_id == campaign_id).order_by(CampaignStep.step_order)
    )
    return result.scalars().all()


@router.post("/{campaign_id}/steps", response_model=CampaignStepResponse, status_code=status.HTTP_201_CREATED)
async def create_step(campaign_id: uuid.UUID, data: CampaignStepCreate, user: CurrentUser, db: DbSession):
    camp_result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == user.tenant_id)
    )
    if not camp_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    step = CampaignStep(
        campaign_id=campaign_id,
        step_order=data.step_order,
        action_type=data.action_type,
        config=data.config or {},
        delay_hours=data.delay_hours,
    )
    db.add(step)
    await db.flush()
    return step


# ── Audiences ──


@router.get("/{campaign_id}/audiences", response_model=list[CampaignAudienceResponse])
async def list_audiences(campaign_id: uuid.UUID, user: CurrentUser, db: DbSession):
    camp_result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == user.tenant_id)
    )
    if not camp_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    result = await db.execute(
        select(CampaignAudience).where(CampaignAudience.campaign_id == campaign_id)
    )
    return result.scalars().all()


@router.post("/{campaign_id}/audiences", response_model=CampaignAudienceResponse, status_code=status.HTTP_201_CREATED)
async def create_audience(campaign_id: uuid.UUID, data: CampaignAudienceCreate, user: CurrentUser, db: DbSession):
    camp_result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == user.tenant_id)
    )
    if not camp_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    audience = CampaignAudience(
        campaign_id=campaign_id,
        name=data.name,
        filters=data.filters or {},
        size=data.size,
    )
    db.add(audience)
    await db.flush()
    return audience
