"""Service layer: builds aggregated dashboard data from SocialMetric / Lead tables."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Lead,
    LeadStatus,
    SocialAccount,
    SocialMetric,
    SocialPost,
)
from app.modules.analytics_dashboard.schemas import (
    DashboardResponse,
    KPICard,
    KPITrendResponse,
    TopPost,
    TrendPoint,
    WeeklyReportResponse,
)


def _safe_pct(current: float, prior: float) -> float | None:
    if prior == 0:
        return None if current == 0 else 100.0
    return round(((current - prior) / prior) * 100.0, 2)


async def _aggregate_metrics_window(
    db: AsyncSession, tenant_id: uuid.UUID, start: datetime, end: datetime
) -> dict[str, float]:
    """Sum reach / impressions / engagement over a window."""
    engagement_expr = func.coalesce(func.sum(
        SocialMetric.likes + SocialMetric.comments + SocialMetric.shares
    ), 0)
    reach_expr = func.coalesce(func.sum(SocialMetric.reach), 0)
    impressions_expr = func.coalesce(func.sum(SocialMetric.impressions), 0)

    stmt = (
        select(
            reach_expr.label("reach"),
            impressions_expr.label("impressions"),
            engagement_expr.label("engagement"),
        )
        .join(SocialPost, SocialPost.id == SocialMetric.social_post_id)
        .where(
            SocialPost.tenant_id == tenant_id,
            SocialMetric.recorded_at >= start,
            SocialMetric.recorded_at < end,
        )
    )
    row = (await db.execute(stmt)).first()
    if not row:
        return {"reach": 0, "impressions": 0, "engagement": 0}
    return {
        "reach": float(row.reach or 0),
        "impressions": float(row.impressions or 0),
        "engagement": float(row.engagement or 0),
    }


async def _daily_trend(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    start: datetime,
    end: datetime,
    value_expr,
) -> list[TrendPoint]:
    stmt = (
        select(
            func.date(SocialMetric.recorded_at).label("d"),
            func.coalesce(func.sum(value_expr), 0).label("v"),
        )
        .join(SocialPost, SocialPost.id == SocialMetric.social_post_id)
        .where(
            SocialPost.tenant_id == tenant_id,
            SocialMetric.recorded_at >= start,
            SocialMetric.recorded_at < end,
        )
        .group_by(func.date(SocialMetric.recorded_at))
        .order_by(func.date(SocialMetric.recorded_at))
    )
    rows = (await db.execute(stmt)).all()
    points: list[TrendPoint] = []
    for r in rows:
        d_val = r.d
        if isinstance(d_val, datetime):
            d_val = d_val.date()
        elif isinstance(d_val, str):
            try:
                d_val = date.fromisoformat(d_val)
            except ValueError:
                continue
        points.append(TrendPoint(date=d_val, value=float(r.v or 0)))
    return points


async def _top_posts(
    db: AsyncSession, tenant_id: uuid.UUID, start: datetime, end: datetime, limit: int = 5
) -> list[TopPost]:
    eng_expr = func.coalesce(func.sum(
        SocialMetric.likes + SocialMetric.comments + SocialMetric.shares
    ), 0)
    reach_expr = func.coalesce(func.sum(SocialMetric.reach), 0)
    stmt = (
        select(
            SocialPost.id,
            SocialPost.content,
            SocialAccount.platform,
            reach_expr.label("reach"),
            eng_expr.label("engagement"),
        )
        .join(SocialAccount, SocialAccount.id == SocialPost.social_account_id)
        .join(SocialMetric, SocialMetric.social_post_id == SocialPost.id, isouter=True)
        .where(
            SocialPost.tenant_id == tenant_id,
            SocialMetric.recorded_at >= start,
            SocialMetric.recorded_at < end,
        )
        .group_by(SocialPost.id, SocialPost.content, SocialAccount.platform)
        .order_by(eng_expr.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    return [
        TopPost(
            id=r.id,
            caption=(r.content or "")[:240],
            platform=r.platform.value if hasattr(r.platform, "value") else str(r.platform),
            reach=int(r.reach or 0),
            engagement=int(r.engagement or 0),
        )
        for r in rows
    ]


async def _leads_by_source(
    db: AsyncSession, tenant_id: uuid.UUID, start: datetime, end: datetime
) -> dict[str, int]:
    stmt = (
        select(Lead.source, func.count(Lead.id))
        .where(
            Lead.tenant_id == tenant_id,
            Lead.created_at >= start,
            Lead.created_at < end,
        )
        .group_by(Lead.source)
    )
    rows = (await db.execute(stmt)).all()
    out: dict[str, int] = {}
    for source, count in rows:
        key = source.value if hasattr(source, "value") else str(source)
        out[key] = int(count)
    return out


async def _lead_counts(
    db: AsyncSession, tenant_id: uuid.UUID, start: datetime, end: datetime
) -> tuple[int, int]:
    total_stmt = select(func.count(Lead.id)).where(
        Lead.tenant_id == tenant_id,
        Lead.created_at >= start,
        Lead.created_at < end,
    )
    won_stmt = select(func.count(Lead.id)).where(
        Lead.tenant_id == tenant_id,
        Lead.created_at >= start,
        Lead.created_at < end,
        Lead.status == LeadStatus.won,
    )
    total = (await db.execute(total_stmt)).scalar() or 0
    won = (await db.execute(won_stmt)).scalar() or 0
    return int(total), int(won)


async def build_dashboard(
    db: AsyncSession, tenant_id: uuid.UUID, period_days: int
) -> DashboardResponse:
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=period_days)
    prior_start = start - timedelta(days=period_days)

    try:
        cur = await _aggregate_metrics_window(db, tenant_id, start, now)
        prior = await _aggregate_metrics_window(db, tenant_id, prior_start, start)
    except Exception:
        cur = {"reach": 0, "impressions": 0, "engagement": 0}
        prior = {"reach": 0, "impressions": 0, "engagement": 0}

    try:
        cur_total_leads, cur_won_leads = await _lead_counts(db, tenant_id, start, now)
        prior_total_leads, _ = await _lead_counts(db, tenant_id, prior_start, start)
    except Exception:
        cur_total_leads = cur_won_leads = prior_total_leads = 0

    conversion_rate = (cur_won_leads / cur_total_leads) if cur_total_leads > 0 else 0.0

    kpis = [
        KPICard(
            key="reach",
            label_en="Reach",
            label_ar="الوصول",
            value=cur["reach"],
            delta_pct=_safe_pct(cur["reach"], prior["reach"]),
            unit="",
        ),
        KPICard(
            key="engagement",
            label_en="Engagement",
            label_ar="التفاعل",
            value=cur["engagement"],
            delta_pct=_safe_pct(cur["engagement"], prior["engagement"]),
            unit="",
        ),
        KPICard(
            key="leads",
            label_en="New Leads",
            label_ar="عملاء جدد",
            value=float(cur_total_leads),
            delta_pct=_safe_pct(cur_total_leads, prior_total_leads),
            unit="",
        ),
        KPICard(
            key="conversion",
            label_en="Conversion Rate",
            label_ar="معدل التحويل",
            value=round(conversion_rate * 100.0, 2),
            delta_pct=None,
            unit="%",
        ),
    ]

    try:
        reach_trend = await _daily_trend(db, tenant_id, start, now, SocialMetric.reach)
        engagement_trend = await _daily_trend(
            db,
            tenant_id,
            start,
            now,
            SocialMetric.likes + SocialMetric.comments + SocialMetric.shares,
        )
    except Exception:
        reach_trend = []
        engagement_trend = []

    try:
        top_posts = await _top_posts(db, tenant_id, start, now)
    except Exception:
        top_posts = []

    try:
        leads_by_source = await _leads_by_source(db, tenant_id, start, now)
    except Exception:
        leads_by_source = {}

    return DashboardResponse(
        kpis=kpis,
        reach_trend=reach_trend,
        engagement_trend=engagement_trend,
        top_posts=top_posts,
        leads_by_source=leads_by_source,
        conversion_rate=round(conversion_rate, 4),
    )


async def build_kpi_trend(
    db: AsyncSession, tenant_id: uuid.UUID, key: str, period_days: int
) -> KPITrendResponse:
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=period_days)
    prior_start = start - timedelta(days=period_days)

    if key == "reach":
        value_expr = SocialMetric.reach
    elif key == "engagement":
        value_expr = SocialMetric.likes + SocialMetric.comments + SocialMetric.shares
    elif key == "impressions":
        value_expr = SocialMetric.impressions
    else:
        return KPITrendResponse(key=key, points=[], total=0.0, delta_pct=None)

    try:
        points = await _daily_trend(db, tenant_id, start, now, value_expr)
        cur_window = await _aggregate_metrics_window(db, tenant_id, start, now)
        prior_window = await _aggregate_metrics_window(db, tenant_id, prior_start, start)
    except Exception:
        return KPITrendResponse(key=key, points=[], total=0.0, delta_pct=None)

    total = cur_window.get(key, 0.0)
    prior = prior_window.get(key, 0.0)
    return KPITrendResponse(
        key=key,
        points=points,
        total=total,
        delta_pct=_safe_pct(total, prior),
    )


async def build_weekly_report(
    db: AsyncSession, tenant_id: uuid.UUID
) -> WeeklyReportResponse:
    dashboard = await build_dashboard(db, tenant_id, period_days=7)
    today = date.today()
    return WeeklyReportResponse(
        period_start=today - timedelta(days=7),
        period_end=today,
        kpis=dashboard.kpis,
        top_posts=dashboard.top_posts,
        leads_by_source=dashboard.leads_by_source,
    )


def dashboard_to_metrics_dict(dash: DashboardResponse) -> dict[str, Any]:
    """Flatten DashboardResponse into a dict suitable for the analytics agent."""
    return {
        "kpis": [k.model_dump() for k in dash.kpis],
        "reach_trend": [p.model_dump(mode="json") for p in dash.reach_trend],
        "engagement_trend": [p.model_dump(mode="json") for p in dash.engagement_trend],
        "top_posts": [p.model_dump(mode="json") for p in dash.top_posts],
        "leads_by_source": dash.leads_by_source,
        "conversion_rate": dash.conversion_rate,
    }
