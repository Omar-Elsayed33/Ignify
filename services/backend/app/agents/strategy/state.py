"""Shared state schema for StrategyAgent graph."""
from __future__ import annotations

from typing import Any, TypedDict


class StrategyState(TypedDict, total=False):
    tenant_id: str
    business_profile: dict[str, Any]   # industry, audience, products, brand voice
    language: str                      # "ar" | "en" | "both"
    period_days: int                   # 30, 60, 90
    market_analysis: dict[str, Any]
    personas: list[dict[str, Any]]
    channels: list[dict[str, Any]]
    calendar: list[dict[str, Any]]
    kpis: list[dict[str, Any]]
    goals: list[str]
    ad_strategy: dict[str, Any]
