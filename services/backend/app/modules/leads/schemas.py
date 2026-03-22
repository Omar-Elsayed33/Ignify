import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel

from app.db.models import LeadSource, LeadStatus


class LeadCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    source: LeadSource = LeadSource.manual
    score: Optional[int] = None
    status: LeadStatus = LeadStatus.new
    assigned_to: Optional[uuid.UUID] = None
    metadata: Optional[dict[str, Any]] = None


class LeadUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    score: Optional[int] = None
    status: Optional[LeadStatus] = None
    assigned_to: Optional[uuid.UUID] = None
    metadata: Optional[dict[str, Any]] = None


class LeadResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    source: LeadSource
    score: Optional[int] = None
    status: LeadStatus
    assigned_to: Optional[uuid.UUID] = None
    metadata: Optional[dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PipelineStageCreate(BaseModel):
    name: str
    order_index: int
    color: Optional[str] = None


class PipelineStageResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    order_index: int
    color: Optional[str] = None

    model_config = {"from_attributes": True}


class LeadActivityCreate(BaseModel):
    lead_id: uuid.UUID
    activity_type: str
    description: Optional[str] = None


class LeadActivityResponse(BaseModel):
    id: uuid.UUID
    lead_id: uuid.UUID
    activity_type: str
    description: Optional[str] = None
    created_by: Optional[uuid.UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}
