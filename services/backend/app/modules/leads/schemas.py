import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel

from app.db.models import LeadSource, LeadStatus


# ── Lead CRUD ──


class LeadCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    source: LeadSource = LeadSource.manual
    score: Optional[int] = None
    status: LeadStatus = LeadStatus.new
    assigned_to: Optional[uuid.UUID] = None
    notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class LeadUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    score: Optional[int] = None
    status: Optional[LeadStatus] = None
    stage: Optional[LeadStatus] = None  # alias for status (Kanban)
    owner_id: Optional[uuid.UUID] = None  # alias for assigned_to
    assigned_to: Optional[uuid.UUID] = None
    notes: Optional[str] = None
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
    activities_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LeadMoveStage(BaseModel):
    stage: Literal["new", "contacted", "qualified", "proposal", "won", "lost"]


class LeadKanbanColumn(BaseModel):
    stage: str
    leads: list[LeadResponse]


# ── Pipeline Stages ──


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


# ── Activities ──


class LeadActivityCreate(BaseModel):
    activity_type: Literal["note", "call", "message", "email", "stage_change"] = "note"
    content: Optional[str] = None
    # legacy aliases
    type: Optional[str] = None
    description: Optional[str] = None
    lead_id: Optional[uuid.UUID] = None


class LeadActivityResponse(BaseModel):
    id: uuid.UUID
    lead_id: uuid.UUID
    activity_type: str
    description: Optional[str] = None
    created_by: Optional[uuid.UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Qualification ──


class LeadQualifyResponse(BaseModel):
    score: int
    qualification: str
    next_action: Optional[str] = None
