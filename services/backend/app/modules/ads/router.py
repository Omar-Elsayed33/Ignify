import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.db.models import AdAccount, AdCampaign, AdPerformance
from app.dependencies import CurrentUser, DbSession
from app.modules.ads.schemas import (
    AdAccountCreate,
    AdAccountResponse,
    AdCampaignCreate,
    AdCampaignResponse,
    AdCampaignUpdate,
    AdPerformanceResponse,
)

router = APIRouter(prefix="/ads", tags=["ads"])


# ── Ad Accounts ──


@router.get("/accounts", response_model=list[AdAccountResponse])
async def list_ad_accounts(user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(AdAccount).where(AdAccount.tenant_id == user.tenant_id).order_by(AdAccount.created_at.desc())
    )
    return result.scalars().all()


@router.post("/accounts", response_model=AdAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_ad_account(data: AdAccountCreate, user: CurrentUser, db: DbSession):
    account = AdAccount(
        tenant_id=user.tenant_id,
        platform=data.platform,
        account_id=data.account_id,
        name=data.name,
        access_token_encrypted=data.access_token_encrypted,
        refresh_token_encrypted=data.refresh_token_encrypted,
    )
    db.add(account)
    await db.flush()
    return account


@router.get("/accounts/{account_id}", response_model=AdAccountResponse)
async def get_ad_account(account_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(AdAccount).where(AdAccount.id == account_id, AdAccount.tenant_id == user.tenant_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ad account not found")
    return account


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ad_account(account_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(AdAccount).where(AdAccount.id == account_id, AdAccount.tenant_id == user.tenant_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ad account not found")
    await db.delete(account)
    await db.flush()


# ── Campaigns ──


@router.get("/campaigns", response_model=list[AdCampaignResponse])
async def list_campaigns(user: CurrentUser, db: DbSession, account_id: uuid.UUID | None = None):
    query = select(AdCampaign).where(AdCampaign.tenant_id == user.tenant_id)
    if account_id:
        query = query.where(AdCampaign.ad_account_id == account_id)
    query = query.order_by(AdCampaign.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/campaigns", response_model=AdCampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(data: AdCampaignCreate, user: CurrentUser, db: DbSession):
    # Verify account belongs to tenant
    acc_result = await db.execute(
        select(AdAccount).where(AdAccount.id == data.ad_account_id, AdAccount.tenant_id == user.tenant_id)
    )
    if not acc_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ad account not found")

    campaign = AdCampaign(
        tenant_id=user.tenant_id,
        ad_account_id=data.ad_account_id,
        platform=data.platform,
        campaign_id_external=data.campaign_id_external,
        name=data.name,
        status=data.status,
        budget_daily=data.budget_daily,
        budget_total=data.budget_total,
        start_date=data.start_date,
        end_date=data.end_date,
        config=data.config or {},
    )
    db.add(campaign)
    await db.flush()
    return campaign


@router.get("/campaigns/{campaign_id}", response_model=AdCampaignResponse)
async def get_campaign(campaign_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(AdCampaign).where(AdCampaign.id == campaign_id, AdCampaign.tenant_id == user.tenant_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return campaign


@router.put("/campaigns/{campaign_id}", response_model=AdCampaignResponse)
async def update_campaign(campaign_id: uuid.UUID, data: AdCampaignUpdate, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(AdCampaign).where(AdCampaign.id == campaign_id, AdCampaign.tenant_id == user.tenant_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(campaign, field, value)
    await db.flush()
    return campaign


# ── Performance ──


@router.get("/campaigns/{campaign_id}/performance", response_model=list[AdPerformanceResponse])
async def get_campaign_performance(campaign_id: uuid.UUID, user: CurrentUser, db: DbSession):
    # Verify campaign belongs to tenant
    camp_result = await db.execute(
        select(AdCampaign).where(AdCampaign.id == campaign_id, AdCampaign.tenant_id == user.tenant_id)
    )
    if not camp_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    result = await db.execute(
        select(AdPerformance)
        .where(AdPerformance.ad_campaign_id == campaign_id)
        .order_by(AdPerformance.date.desc())
    )
    return result.scalars().all()
