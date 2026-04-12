"""Shared state schema for AnalyticsAgent graph."""
from __future__ import annotations

from typing import Any, TypedDict


class AnalyticsState(TypedDict, total=False):
    tenant_id: str
    period_days: int
    metrics: dict[str, Any]
    trends: dict[str, Any]
    top_posts: list[dict[str, Any]]
    language: str
    summary: str | None
    insights: list[str]
    recommendations: list[str]
