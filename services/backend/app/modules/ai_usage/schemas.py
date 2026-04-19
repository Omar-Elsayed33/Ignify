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
