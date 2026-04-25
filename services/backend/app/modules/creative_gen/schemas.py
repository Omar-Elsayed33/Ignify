from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class CreativeGenerateRequest(BaseModel):
    idea: str = Field(..., min_length=1, max_length=2000)
    style: str = Field("photo", pattern="^(photo|illustration|3d|minimal|anime)$")
    dimensions: str = Field("1:1", pattern="^(1:1|9:16|16:9|4:5)$")
    language: str = Field("en", pattern="^(ar|en|both)$")
    brand_voice: dict[str, Any] | None = None
    plan_id: uuid.UUID | None = None
    # Phase 8: when set, anchors the generation to a specific content post.
    # Enables regen-limit counting (max 1 retry per post) and provenance.
    content_post_id: uuid.UUID | None = None
    # Phase 8: target platform; the Creative Brief agent uses it to pick
    # aspect ratio + visual conventions (e.g. Instagram Stories → 9:16).
    platform: str | None = None


class CreativeAssetOut(BaseModel):
    creative_id: uuid.UUID
    file_url: str


class CreativeGenerateResponse(BaseModel):
    creative_id: uuid.UUID | None = None
    prompt: str | None = None
    image_urls: list[str] = []
    assets: list[CreativeAssetOut] = []
    meta: dict[str, Any] = {}


class CreativeAssetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    asset_type: str
    file_url: str | None = None
    thumbnail_url: str | None = None
    prompt_used: str | None = None
    metadata_: dict[str, Any] | None = Field(default=None, serialization_alias="metadata")
    created_at: datetime


class AttachCreativeRequest(BaseModel):
    creative_id: uuid.UUID
