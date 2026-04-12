import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.agents.registry import get_agent
from app.db.models import AdAccount, AdCampaign, AdPerformance
from app.dependencies import CurrentUser, DbSession
from app.modules.ads import service as ads_service
from app.modules.ads.schemas import (
    AdAccountCreate,
    AdAccountResponse,
    AdCampaignCreate,
    AdCampaignResponse,
    AdCampaignUpdate,
    AdPerformanceResponse,
    CampaignInsightsResponse,
    GenerateCampaignsRequest,
    GenerateCampaignsResponse,
    LaunchCampaignRequest,
    LaunchCampaignResponse,
    MetaAdAccountSummary,
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


# ── Meta Ads Orchestrator ──


@router.post("/accounts/sync", response_model=list[AdAccountResponse])
async def sync_meta_accounts(user: CurrentUser, db: DbSession):
    """Pull ad accounts from Meta for this tenant and upsert AdAccount rows."""
    rows = await ads_service.sync_meta_ad_accounts(db, user.tenant_id)
    return rows


@router.post("/campaigns/generate", response_model=GenerateCampaignsResponse)
async def generate_campaigns(
    data: GenerateCampaignsRequest, user: CurrentUser, db: DbSession
):
    """Run AdsAgent to propose campaigns. Does NOT create anything on Meta."""
    acc_q = await db.execute(
        select(AdAccount).where(
            AdAccount.id == data.ad_account_id, AdAccount.tenant_id == user.tenant_id
        )
    )
    account = acc_q.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ad account not found")

    agent = get_agent("ads", tenant_id=str(user.tenant_id))
    thread_id = f"ads-gen-{uuid.uuid4()}"
    state_in: dict = {
        "tenant_id": str(user.tenant_id),
        "objective": data.objective,
        "budget_usd": data.budget_usd,
        "duration_days": data.duration_days,
        "target_audience": data.target_audience or {},
        "products": data.products or [],
        "creative_urls": data.creative_urls or [],
        "ad_account_id": account.account_id,
        "page_id": data.page_id or "",
        "language": data.language,
    }
    out = await agent.run(state_in, thread_id=thread_id)
    return GenerateCampaignsResponse(
        targeting_spec=out.get("targeting_spec", {}),
        proposed_campaigns=out.get("proposed_campaigns", []),
        proposed_adsets=out.get("proposed_adsets", []),
        proposed_creatives=out.get("proposed_creatives", []),
        optimization_notes=out.get("optimization_notes", []),
        reasoning=out.get("reasoning", ""),
    )


@router.post("/campaigns/launch", response_model=LaunchCampaignResponse, status_code=status.HTTP_201_CREATED)
async def launch_campaign(
    data: LaunchCampaignRequest, user: CurrentUser, db: DbSession
):
    """Create campaign→adset→creative→ad on Meta and persist a local row."""
    acc_q = await db.execute(
        select(AdAccount).where(
            AdAccount.id == data.ad_account_id, AdAccount.tenant_id == user.tenant_id
        )
    )
    account = acc_q.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ad account not found")

    result = await ads_service.launch_campaign_on_meta(
        db,
        tenant_id=user.tenant_id,
        account_row=account,
        page_id=data.page_id,
        campaign=data.campaign,
        adset=data.adset,
        creative=data.creative,
        targeting_spec=data.targeting_spec,
        duration_days=data.duration_days,
    )
    return LaunchCampaignResponse(**result)


@router.post("/campaigns/{campaign_id}/pause", response_model=AdCampaignResponse)
async def pause_campaign(campaign_id: uuid.UUID, user: CurrentUser, db: DbSession):
    row = await ads_service.update_campaign_status_on_meta(
        db, tenant_id=user.tenant_id, campaign_id=campaign_id, status="PAUSED"
    )
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return row


@router.post("/campaigns/{campaign_id}/resume", response_model=AdCampaignResponse)
async def resume_campaign(campaign_id: uuid.UUID, user: CurrentUser, db: DbSession):
    row = await ads_service.update_campaign_status_on_meta(
        db, tenant_id=user.tenant_id, campaign_id=campaign_id, status="ACTIVE"
    )
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return row


@router.post("/campaigns/{campaign_id}/stop", response_model=AdCampaignResponse)
async def stop_campaign(campaign_id: uuid.UUID, user: CurrentUser, db: DbSession):
    row = await ads_service.update_campaign_status_on_meta(
        db, tenant_id=user.tenant_id, campaign_id=campaign_id, status="ARCHIVED"
    )
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return row


@router.get("/campaigns/{campaign_id}/insights", response_model=CampaignInsightsResponse)
async def get_campaign_live_insights(
    campaign_id: uuid.UUID, user: CurrentUser, db: DbSession
):
    data = await ads_service.fetch_and_cache_insights(
        db, tenant_id=user.tenant_id, campaign_id=campaign_id
    )
    if data is None:
        raise HTTPException(status_code=404, detail="Campaign not found or not launched")
    return CampaignInsightsResponse(**data)
