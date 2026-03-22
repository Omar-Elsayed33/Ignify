import uuid
from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel


class OverviewResponse(BaseModel):
    total_leads: int
    total_campaigns: int
    total_channels: int
    total_content_posts: int
    total_social_posts: int
    total_ad_campaigns: int
    credit_balance: int


class ReportCreate(BaseModel):
    name: str
    report_type: str
    config: Optional[dict[str, Any]] = None


class ReportResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    report_type: str
    config: Optional[dict[str, Any]] = None
    file_url: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ReportSnapshotCreate(BaseModel):
    report_id: uuid.UUID
    data: Optional[dict[str, Any]] = None
    period_start: date
    period_end: date


class ReportSnapshotResponse(BaseModel):
    id: uuid.UUID
    report_id: uuid.UUID
    data: Optional[dict[str, Any]] = None
    period_start: date
    period_end: date
    created_at: datetime

    model_config = {"from_attributes": True}
