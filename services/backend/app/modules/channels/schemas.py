import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel

from app.db.models import ChannelStatus, ChannelType


class ChannelCreate(BaseModel):
    type: ChannelType
    name: str
    config: Optional[dict[str, Any]] = None


class ChannelUpdate(BaseModel):
    name: Optional[str] = None
    config: Optional[dict[str, Any]] = None
    status: Optional[ChannelStatus] = None


class ChannelResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    type: ChannelType
    name: str
    config: Optional[dict[str, Any]] = None
    status: ChannelStatus
    created_at: datetime

    model_config = {"from_attributes": True}
