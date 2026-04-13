"""Shared state schema for StrategyAgent graph."""
from __future__ import annotations

from typing import Any, TypedDict


class StrategyState(TypedDict, total=False):
    tenant_id: str
    business_profile: dict[str, Any]   # industry, audience, products, brand voice
    language: str                      # "ar" | "en" | "both"
    period_days: int                   # 30, 60, 90

    # Budget + goals inputs (Step 1)
    budget_monthly_usd: float
    budget_currency: str               # "usd" | "egp" | "sar" | "aed"
    primary_goal: str
    urgency_days: int

    # Existing outputs
    market_analysis: dict[str, Any]
    personas: list[dict[str, Any]]
    channels: list[dict[str, Any]]
    calendar: list[dict[str, Any]]
    kpis: list[dict[str, Any]]
    goals: list[str]
    ad_strategy: dict[str, Any]

    # New strategic outputs (Step 3)
    positioning: dict[str, Any]
    customer_journey: dict[str, Any]
    offer: dict[str, Any]
    funnel: dict[str, Any]
    conversion: dict[str, Any]
    retention: dict[str, Any]
    growth_loops: dict[str, Any]
    execution_roadmap: list[dict[str, Any]]
