import uuid
from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel

from app.db.models import CampaignStatus, CampaignType


class CampaignCreate(BaseModel):
    name: str
    campaign_type: CampaignType
    status: CampaignStatus = CampaignStatus.draft
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    config: Optional[dict[str, Any]] = None


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[CampaignStatus] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    config: Optional[dict[str, Any]] = None


class CampaignResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    campaign_type: CampaignType
    status: CampaignStatus
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    config: Optional[dict[str, Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CampaignStepCreate(BaseModel):
    step_order: int
    action_type: str
    config: Optional[dict[str, Any]] = None
    delay_hours: int = 0


class CampaignStepResponse(BaseModel):
    id: uuid.UUID
    campaign_id: uuid.UUID
    step_order: int
    action_type: str
    config: Optional[dict[str, Any]] = None
    delay_hours: int

    model_config = {"from_attributes": True}


class CampaignGenerateRequest(BaseModel):
    goal: str
    campaign_type: CampaignType = CampaignType.multi_channel
    target_audience: Optional[str] = None
    budget: Optional[str] = None
    duration_days: int = 30
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class CampaignAudienceCreate(BaseModel):
    name: str
    filters: Optional[dict[str, Any]] = None
    size: int = 0


class CampaignAudienceResponse(BaseModel):
    id: uuid.UUID
    campaign_id: uuid.UUID
    name: str
    filters: Optional[dict[str, Any]] = None
    size: int

    model_config = {"from_attributes": True}
