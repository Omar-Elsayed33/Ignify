import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel

from app.db.models import IntegrationStatus


class IntegrationCreate(BaseModel):
    platform: str
    config: Optional[dict[str, Any]] = None


class IntegrationResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    platform: str
    status: IntegrationStatus
    config: Optional[dict[str, Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class OAuthCallbackRequest(BaseModel):
    integration_id: uuid.UUID
    code: str
    state: Optional[str] = None
