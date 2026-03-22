import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class CompetitorCreate(BaseModel):
    name: str
    website: Optional[str] = None
    description: Optional[str] = None


class CompetitorUpdate(BaseModel):
    name: Optional[str] = None
    website: Optional[str] = None
    description: Optional[str] = None


class CompetitorResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    website: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CompetitorSnapshotResponse(BaseModel):
    id: uuid.UUID
    competitor_id: uuid.UUID
    data: Optional[dict[str, Any]] = None
    snapshot_type: str
    created_at: datetime

    model_config = {"from_attributes": True}
