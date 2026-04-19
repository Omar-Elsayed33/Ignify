import uuid
from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel

from app.db.models import ContentStatus, PostType


class ContentPostCreate(BaseModel):
    title: str
    body: Optional[str] = None
    post_type: PostType
    platform: Optional[str] = None
    status: ContentStatus = ContentStatus.draft
    scheduled_at: Optional[datetime] = None
    metadata: Optional[dict[str, Any]] = None


class ContentPostUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    post_type: Optional[PostType] = None
    platform: Optional[str] = None
    status: Optional[ContentStatus] = None
    scheduled_at: Optional[datetime] = None
    metadata: Optional[dict[str, Any]] = None


class ContentPostResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    title: str
    body: Optional[str] = None
    post_type: PostType
    platform: Optional[str] = None
    status: ContentStatus
    scheduled_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    metadata: Optional[dict[str, Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class ContentGenerateRequest(BaseModel):
    topic: str
    post_type: PostType
    platform: Optional[str] = None
    tone: Optional[str] = None
    keywords: Optional[list[str]] = None
    max_length: Optional[int] = None


class ContentGenerateResponse(BaseModel):
    title: str
    body: str
    metadata: Optional[dict[str, Any]] = None


class CalendarEntryCreate(BaseModel):
    content_post_id: uuid.UUID
    scheduled_date: date
    platform: Optional[str] = None


class CalendarEntryResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    content_post_id: uuid.UUID
    scheduled_date: date
    platform: Optional[str] = None
    status: ContentStatus

    model_config = {"from_attributes": True}
