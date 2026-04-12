"""Schemas for the Analytics Dashboard module (KPIs, trends, report payloads)."""
from __future__ import annotations

import uuid
from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class KPICard(BaseModel):
    key: str
    label_en: str
    label_ar: str
    value: float
    delta_pct: Optional[float] = None
    unit: str = ""


class TrendPoint(BaseModel):
    date: date
    value: float


class TopPost(BaseModel):
    id: uuid.UUID
    caption: str
    platform: str
    reach: int
    engagement: int


class DashboardResponse(BaseModel):
    kpis: list[KPICard]
    reach_trend: list[TrendPoint]
    engagement_trend: list[TrendPoint]
    top_posts: list[TopPost]
    leads_by_source: dict[str, int]
    conversion_rate: float


class PeriodCompareQuery(BaseModel):
    period: str = Field(default="7d", pattern="^(7d|30d|90d)$")


class KPITrendResponse(BaseModel):
    key: str
    points: list[TrendPoint]
    total: float
    delta_pct: Optional[float] = None


class WeeklyReportResponse(BaseModel):
    period_start: date
    period_end: date
    kpis: list[KPICard]
    top_posts: list[TopPost]
    leads_by_source: dict[str, int]


class AgentReportResponse(BaseModel):
    summary: str
    insights: list[str]
    recommendations: list[str]


def period_to_days(period: str) -> int:
    return {"7d": 7, "30d": 30, "90d": 90}.get(period, 7)
