import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class TenantResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    plan_id: Optional[uuid.UUID] = None
    is_active: bool
    subscription_active: bool = False
    config: Optional[dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    config: Optional[dict[str, Any]] = None
