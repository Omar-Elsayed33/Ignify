from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class AIUsageResponse(BaseModel):
    monthly_limit_usd: float
    usage_usd: float
    remaining_usd: float
    usage_pct: float
    reset_at: Optional[datetime]
    usage_synced_at: Optional[datetime]
    has_key: bool
    # Phase 5 P1: surface gate state to the frontend so the widget can show
    # an amber banner at 80% and a red banner at 100%.
    soft_warning: bool = False  # True once usage_pct >= 80
    blocked: bool = False       # True once remaining_usd <= 0
    deep_runs_this_month: int = 0
    deep_runs_cap: int = 10


class AdminTenantAIUsageRow(BaseModel):
    tenant_id: UUID
    tenant_name: str
    plan_slug: Optional[str]
    monthly_limit_usd: float
    usage_usd: float
    remaining_usd: float
    usage_pct: float
    usage_synced_at: Optional[datetime]
    has_key: bool


class AdminAIUsageResponse(BaseModel):
    tenants: list[AdminTenantAIUsageRow]
    total_tenants: int
    total_usage_usd: float
    total_limit_usd: float
