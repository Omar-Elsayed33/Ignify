import uuid
from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel

from app.db.models import AdPlatform


class AdAccountCreate(BaseModel):
    platform: AdPlatform
    account_id: str
    name: str
    access_token_encrypted: Optional[str] = None
    refresh_token_encrypted: Optional[str] = None


class AdAccountResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    platform: AdPlatform
    account_id: str
    name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AdCampaignCreate(BaseModel):
    ad_account_id: uuid.UUID
    platform: AdPlatform
    name: str
    campaign_id_external: Optional[str] = None
    status: str = "draft"
    budget_daily: Optional[float] = None
    budget_total: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    config: Optional[dict[str, Any]] = None


class AdCampaignUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    budget_daily: Optional[float] = None
    budget_total: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    config: Optional[dict[str, Any]] = None


class AdCampaignResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    ad_account_id: uuid.UUID
    platform: AdPlatform
    campaign_id_external: Optional[str] = None
    name: str
    status: str
    budget_daily: Optional[float] = None
    budget_total: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    config: Optional[dict[str, Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MetaAdAccountSummary(BaseModel):
    external_id: str
    account_id: str
    name: str
    currency: Optional[str] = None
    timezone_name: Optional[str] = None
    account_status: Optional[int] = None


class GenerateCampaignsRequest(BaseModel):
    ad_account_id: uuid.UUID
    objective: str = "traffic"
    budget_usd: float
    duration_days: int = 7
    target_audience: Optional[dict[str, Any]] = None
    products: Optional[list[dict[str, Any]]] = None
    creative_urls: Optional[list[str]] = None
    page_id: Optional[str] = None
    language: str = "en"


class GenerateCampaignsResponse(BaseModel):
    targeting_spec: dict[str, Any]
    proposed_campaigns: list[dict[str, Any]]
    proposed_adsets: list[dict[str, Any]]
    proposed_creatives: list[dict[str, Any]]
    optimization_notes: list[str]
    reasoning: str


class LaunchCampaignRequest(BaseModel):
    ad_account_id: uuid.UUID
    page_id: str
    campaign: dict[str, Any]   # one entry from proposed_campaigns
    adset: dict[str, Any]      # one entry from proposed_adsets
    creative: dict[str, Any]   # one entry from proposed_creatives
    targeting_spec: dict[str, Any]
    duration_days: int = 7


class LaunchCampaignResponse(BaseModel):
    campaign_row_id: uuid.UUID
    external_campaign_id: str
    external_adset_id: str
    external_creative_id: str
    external_ad_id: str
    stub: bool


class CampaignInsightsResponse(BaseModel):
    campaign_id: uuid.UUID
    impressions: int
    clicks: int
    spend: float
    ctr: Optional[float] = None
    cpc: Optional[float] = None
    reach: Optional[int] = None


class AdPerformanceResponse(BaseModel):
    id: uuid.UUID
    ad_campaign_id: uuid.UUID
    date: date
    impressions: int
    clicks: int
    conversions: int
    spend: float
    revenue: float
    ctr: Optional[float] = None
    cpc: Optional[float] = None
    roas: Optional[float] = None
    metadata: Optional[dict[str, Any]] = None

    model_config = {"from_attributes": True}
