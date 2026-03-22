import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel

from app.db.models import SocialPlatform, SocialPostStatus


class SocialAccountCreate(BaseModel):
    platform: SocialPlatform
    account_id: str
    name: str
    access_token_encrypted: Optional[str] = None


class SocialAccountResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    platform: SocialPlatform
    account_id: str
    name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SocialPostCreate(BaseModel):
    social_account_id: uuid.UUID
    content: str
    media_urls: Optional[list[str]] = None
    status: SocialPostStatus = SocialPostStatus.draft
    scheduled_at: Optional[datetime] = None


class SocialPostUpdate(BaseModel):
    content: Optional[str] = None
    media_urls: Optional[list[str]] = None
    status: Optional[SocialPostStatus] = None
    scheduled_at: Optional[datetime] = None


class SocialPostResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    social_account_id: uuid.UUID
    content: str
    media_urls: Optional[Any] = None
    status: SocialPostStatus
    scheduled_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    external_post_id: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SocialMetricResponse(BaseModel):
    id: uuid.UUID
    social_post_id: uuid.UUID
    likes: int
    comments: int
    shares: int
    impressions: int
    reach: int
    engagement_rate: Optional[float] = None
    recorded_at: datetime

    model_config = {"from_attributes": True}
