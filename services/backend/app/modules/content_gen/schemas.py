from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel, Field


class ContentGenerateRequest(BaseModel):
    brief: str = Field(..., min_length=1, max_length=5000)
    target: str = Field("post", pattern="^(post|blog|caption|ad_copy)$")
    channel: str = Field("", max_length=100)
    language: str = Field("ar", pattern="^(ar|en|both)$")
    brand_voice: dict[str, Any] | None = None
    model_override: str | None = None
    plan_id: uuid.UUID | None = None
    variants: int = Field(1, ge=1, le=3)  # generate N independent drafts; UI can show as options


class ContentGenerateResponse(BaseModel):
    content_item_id: uuid.UUID
    draft: str | None = None
    final: str | None = None
    title: str | None = None
    hashtags: list[str] = []
    meta: dict[str, Any] = {}


class BulkGenerateItem(BaseModel):
    brief: str = Field(..., max_length=5000)
    target: str = "post"
    channel: str = ""
    language: str = "ar"
    brand_voice: dict[str, Any] | None = None
    model_override: str | None = None


class BulkGenerateRequest(BaseModel):
    items: list[BulkGenerateItem] = Field(default_factory=list)
    concurrency: int = Field(3, ge=1, le=10)


class BulkGenerateResultItem(BaseModel):
    index: int
    status: str
    content_item_id: uuid.UUID | None = None
    title: str | None = None
    final: str | None = None
    hashtags: list[str] = []
    error: str | None = None


class BulkGenerateResponse(BaseModel):
    results: list[BulkGenerateResultItem]
