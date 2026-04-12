from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


class PlanGenerateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    period_days: int = Field(30, ge=7, le=180)
    language: str = Field("ar", pattern="^(ar|en|both)$")
    business_profile: dict[str, Any] | None = None  # if omitted, pulled from BrandSettings
    model_override: str | None = None


class PlanResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    title: str
    status: str
    version: int
    period_start: date | None = None
    period_end: date | None = None
    goals: list[Any] = []
    personas: list[Any] = []
    channels: list[Any] = []
    calendar: list[Any] = []
    kpis: list[Any] = []
    market_analysis: dict[str, Any] = {}
    ad_strategy: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PlanListItem(BaseModel):
    id: uuid.UUID
    title: str
    status: str
    version: int
    period_start: date | None = None
    period_end: date | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PlanUpdateSection(BaseModel):
    section: str = Field(..., pattern="^(goals|personas|channels|calendar|kpis|market_analysis)$")
    value: Any
