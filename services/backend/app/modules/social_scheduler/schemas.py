from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class OAuthStartResponse(BaseModel):
    url: str
    state: str


class SocialAccountResponse(BaseModel):
    id: uuid.UUID
    platform: str
    page_name: str
    page_id: str
    connected_at: datetime
    expires_at: datetime | None = None

    model_config = {"from_attributes": True}


class SchedulePostRequest(BaseModel):
    content_post_id: uuid.UUID | None = None
    platforms: list[str]
    scheduled_at: datetime
    caption: str
    media_urls: list[str] = Field(default_factory=list)
    publish_mode: str = Field(default="auto", pattern="^(auto|manual)$")


class ScheduledPostResponse(BaseModel):
    id: uuid.UUID
    platform: str
    scheduled_at: datetime | None
    status: str
    caption: str
    media_urls: list[str] = Field(default_factory=list)
    external_id: str | None = None
    error: str | None = None
    content_post_id: uuid.UUID | None = None
    content_post_title: str | None = None
    publish_mode: str = "auto"

    model_config = {"from_attributes": True}


class BestTimeSuggestion(BaseModel):
    day: str
    hour: int
    score: float


class BestTimesResponse(BaseModel):
    suggestions: list[dict[str, Any]]
