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
