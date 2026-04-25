from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


class PlanGenerateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    period_days: int = Field(30, ge=7, le=180)
    language: str = Field("ar", pattern="^(ar|en|both)$")
    plan_mode: str = Field("fast", pattern="^(fast|medium|deep)$")
    business_profile: dict[str, Any] | None = None  # if omitted, pulled from BrandSettings
    model_override: str | None = None  # superadmin-only global override
    # Strategic inputs
    budget_monthly_usd: float | None = None
    budget_currency: str = Field("usd", pattern="^(usd|egp|sar|aed)$")
    primary_goal: str | None = Field(None, max_length=1000)
    urgency_days: int = Field(30, ge=7, le=180)


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
    # Strategic sections
    positioning: dict[str, Any] | None = None
    customer_journey: dict[str, Any] | None = None
    offer: dict[str, Any] | None = None
    funnel: dict[str, Any] | None = None
    conversion: dict[str, Any] | None = None
    retention: dict[str, Any] | None = None
    growth_loops: dict[str, Any] | None = None
    execution_roadmap: list[Any] = []
    budget_monthly_usd: float | None = None
    primary_goal: str | None = None
    plan_mode: str = "fast"
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
