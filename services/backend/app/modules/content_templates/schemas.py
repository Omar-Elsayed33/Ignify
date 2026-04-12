from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ContentTemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    type: str = Field("post", max_length=50)
    channel: Optional[str] = Field(None, max_length=100)
    language: str = Field("ar", max_length=10)
    brief_template: Optional[str] = None
    system_prompt: Optional[str] = None
    is_favorite: bool = False


class ContentTemplateCreate(ContentTemplateBase):
    pass


class ContentTemplateUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    channel: Optional[str] = None
    language: Optional[str] = None
    brief_template: Optional[str] = None
    system_prompt: Optional[str] = None
    is_favorite: Optional[bool] = None


class ContentTemplateResponse(ContentTemplateBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    created_by: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
