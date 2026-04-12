from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class VariantConfigIn(BaseModel):
    variant_label: str = Field(..., min_length=1, max_length=8)
    model_override: Optional[str] = None
    prompt_override: Optional[str] = None


class ExperimentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    brief: str = Field(..., min_length=1)
    target: str = Field("post", max_length=50)
    channel: Optional[str] = Field(None, max_length=100)
    language: str = Field("ar", max_length=10)
    variants: list[VariantConfigIn] = Field(..., min_length=2, max_length=4)
    traffic_split: Optional[dict[str, Any]] = None


class VariantOut(BaseModel):
    id: uuid.UUID
    experiment_id: uuid.UUID
    variant_label: str
    content_post_id: Optional[uuid.UUID] = None
    prompt_override: Optional[str] = None
    model_override: Optional[str] = None
    status: str
    error: Optional[str] = None
    impressions: int
    clicks: int
    engagements: int
    conversions: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ExperimentOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    brief: str
    target: str
    channel: Optional[str] = None
    language: str
    status: str
    winner_variant_id: Optional[uuid.UUID] = None
    traffic_split: Optional[dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ExperimentDetail(ExperimentOut):
    variants: list[VariantOut] = []


class TrackEvent(BaseModel):
    variant_id: uuid.UUID
    metric: Literal["impressions", "clicks", "engagements", "conversions"]
    value: int = Field(1, ge=1, le=10000)


class TrackResponse(BaseModel):
    ok: bool = True
    variant_id: uuid.UUID
    metric: str
    new_value: int


class WinnerResponse(BaseModel):
    experiment_id: uuid.UUID
    winner_variant_id: Optional[uuid.UUID] = None
    status: str
