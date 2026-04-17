import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import and_, func, select

from app.db.models import (
    AdCampaign,
    Campaign,
    Channel,
    Competitor,
    CompetitorSnapshot,
    ContentPost,
    CreditBalance,
    Lead,
    MarketingPlan,
    Report,
    ReportSnapshot,
    SEOKeyword,
    SEORanking,
    SocialMetric,
    SocialPost,
    SocialPostStatus,
)
from app.dependencies import CurrentUser, DbSession
from app.modules.analytics.schemas import (
    OverviewResponse,
    ReportCreate,
    ReportResponse,
    ReportSnapshotCreate,
    ReportSnapshotResponse,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview", response_model=OverviewResponse)
async def get_overview(user: CurrentUser, db: DbSession):
    tid = user.tenant_id

    leads_count = (await db.execute(select(func.count(Lead.id)).where(Lead.tenant_id == tid))).scalar() or 0
    campaigns_count = (await db.execute(select(func.count(Campaign.id)).where(Campaign.tenant_id == tid))).scalar() or 0
    channels_count = (await db.execute(select(func.count(Channel.id)).where(Channel.tenant_id == tid))).scalar() or 0
    content_count = (await db.execute(select(func.count(ContentPost.id)).where(ContentPost.tenant_id == tid))).scalar() or 0
    social_count = (await db.execute(select(func.count(SocialPost.id)).where(SocialPost.tenant_id == tid))).scalar() or 0
    ad_count = (await db.execute(select(func.count(AdCampaign.id)).where(AdCampaign.tenant_id == tid))).scalar() or 0

    balance_result = await db.execute(select(CreditBalance).where(CreditBalance.tenant_id == tid))
    balance = balance_result.scalar_one_or_none()
    credit_balance = balance.balance if balance else 0

    return OverviewResponse(
        total_leads=leads_count,
        total_campaigns=campaigns_count,
        total_channels=channels_count,
        total_content_posts=content_count,
        total_social_posts=social_count,
        total_ad_campaigns=ad_count,
        credit_balance=credit_balance,
    )


# ── Reports ──


@router.get("/reports", response_model=list[ReportResponse])
async def list_reports(user: CurrentUser, db: DbSession, skip: int = 0, limit: int = 50):
    result = await db.execute(
        select(Report)
        .where(Report.tenant_id == user.tenant_id)
        .order_by(Report.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/reports", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(data: ReportCreate, user: CurrentUser, db: DbSession):
    report = Report(
        tenant_id=user.tenant_id,
        name=data.name,
        report_type=data.report_type,
        config=data.config or {},
    )
    db.add(report)
    await db.flush()
    return report


@router.get("/reports/{report_id}", response_model=ReportResponse)
async def get_report(report_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.tenant_id == user.tenant_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return report


@router.delete("/reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(report_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.tenant_id == user.tenant_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    await db.delete(report)
    await db.flush()


# ── Snapshots ──


@router.get("/reports/{report_id}/snapshots", response_model=list[ReportSnapshotResponse])
async def list_snapshots(report_id: uuid.UUID, user: CurrentUser, db: DbSession):
    rpt_result = await db.execute(
        select(Report).where(Report.id == report_id, Report.tenant_id == user.tenant_id)
    )
    if not rpt_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    result = await db.execute(
        select(ReportSnapshot).where(ReportSnapshot.report_id == report_id).order_by(ReportSnapshot.created_at.desc())
    )
    return result.scalars().all()


@router.post("/reports/{report_id}/snapshots", response_model=ReportSnapshotResponse, status_code=status.HTTP_201_CREATED)
async def create_snapshot(report_id: uuid.UUID, data: ReportSnapshotCreate, user: CurrentUser, db: DbSession):
    rpt_result = await db.execute(
        select(Report).where(Report.id == report_id, Report.tenant_id == user.tenant_id)
    )
    if not rpt_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    snapshot = ReportSnapshot(
        report_id=report_id,
        data=data.data or {},
        period_start=data.period_start,
        period_end=data.period_end,
    )
    db.add(snapshot)
    await db.flush()
    return snapshot


# ──────────────────────────── Extended endpoints (Phase 3) ──────────────────────────────


@router.get("/plans/{plan_id}/roi")
async def get_plan_roi(plan_id: uuid.UUID, user: CurrentUser, db: DbSession):
    """Return ROI-style attribution metrics for a marketing plan.

    Attribution is based on ContentPost rows whose `metadata.plan_id == plan_id`.
    Social metrics come from SocialPost → SocialMetric joins where the underlying
    ContentPost is attributed to this plan.
    """
    plan_res = await db.execute(
        select(MarketingPlan).where(
            MarketingPlan.id == plan_id, MarketingPlan.tenant_id == user.tenant_id
        )
    )
    if not plan_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="plan_not_found")

    posts_res = await db.execute(
        select(ContentPost).where(
            ContentPost.tenant_id == user.tenant_id,
            ContentPost.metadata_["plan_id"].astext == str(plan_id),
        )
    )
    posts = posts_res.scalars().all()
    post_ids = [p.id for p in posts]

    if not post_ids:
        return {
            "plan_id": str(plan_id),
            "posts_attributed": 0,
            "posts_published": 0,
            "total_reach": 0,
            "total_impressions": 0,
            "avg_engagement_rate": 0.0,
            "timeseries": [],
        }

    # Join social posts + metrics.
    sp_res = await db.execute(
        select(SocialPost).where(SocialPost.content_post_id.in_(post_ids))
    )
    social_posts = sp_res.scalars().all()
    sp_ids = [sp.id for sp in social_posts]

    published = sum(1 for sp in social_posts if sp.status == SocialPostStatus.published)

    total_reach = 0
    total_impr = 0
    total_eng = 0.0
    metric_count = 0
    if sp_ids:
        m_res = await db.execute(
            select(SocialMetric).where(SocialMetric.social_post_id.in_(sp_ids))
        )
        for m in m_res.scalars().all():
            total_reach += int(m.reach or 0)
            total_impr += int(m.impressions or 0)
            if m.engagement_rate is not None:
                total_eng += float(m.engagement_rate)
                metric_count += 1

    avg_eng = round(total_eng / metric_count, 2) if metric_count else 0.0

    # 30-day timeseries (bucketed by day) of posts published.
    from collections import defaultdict
    buckets: dict[str, int] = defaultdict(int)
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    for sp in social_posts:
        if sp.published_at and sp.published_at >= cutoff:
            key = sp.published_at.date().isoformat()
            buckets[key] += 1
    timeseries = sorted([{"date": k, "posts": v} for k, v in buckets.items()], key=lambda x: x["date"])

    return {
        "plan_id": str(plan_id),
        "posts_attributed": len(posts),
        "posts_published": published,
        "total_reach": total_reach,
        "total_impressions": total_impr,
        "avg_engagement_rate": avg_eng,
        "timeseries": timeseries,
    }


@router.get("/competitors/deltas")
async def get_competitor_deltas(user: CurrentUser, db: DbSession, days: int = 7):
    """Return per-competitor changes in follower/engagement metrics between
    the newest snapshot and the one closest to `days` ago.
    """
    days = max(1, min(days, 90))
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    comp_res = await db.execute(
        select(Competitor).where(Competitor.tenant_id == user.tenant_id)
    )
    competitors = comp_res.scalars().all()

    out = []
    for comp in competitors:
        snaps_res = await db.execute(
            select(CompetitorSnapshot)
            .where(CompetitorSnapshot.competitor_id == comp.id)
            .order_by(CompetitorSnapshot.created_at.desc())
        )
        snaps = list(snaps_res.scalars().all())
        if len(snaps) < 2:
            continue

        newest = snaps[0]
        # Find the first snapshot older than cutoff, else use the oldest.
        baseline = next((s for s in snaps[1:] if s.created_at and s.created_at <= cutoff), snaps[-1])

        def _n(d, k):
            try:
                return float((d or {}).get(k) or 0)
            except (TypeError, ValueError):
                return 0.0

        new_metrics = newest.data or {}
        base_metrics = baseline.data or {}

        out.append({
            "competitor_id": str(comp.id),
            "name": comp.name,
            "baseline_at": baseline.created_at.isoformat() if baseline.created_at else None,
            "latest_at": newest.created_at.isoformat() if newest.created_at else None,
            "followers_delta": _n(new_metrics, "followers") - _n(base_metrics, "followers"),
            "posts_delta": _n(new_metrics, "posts") - _n(base_metrics, "posts"),
            "engagement_rate_delta": _n(new_metrics, "engagement_rate") - _n(base_metrics, "engagement_rate"),
        })

    return {"days": days, "competitors": out}


@router.get("/seo/ctr-trend")
async def get_seo_ctr_trend(user: CurrentUser, db: DbSession, days: int = 28):
    """Return a daily CTR + impressions trend for the tenant's tracked SEO keywords.

    Falls back to an empty array if GSC data hasn't been synced yet.
    """
    days = max(7, min(days, 90))
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    kw_res = await db.execute(
        select(SEOKeyword).where(SEOKeyword.tenant_id == user.tenant_id)
    )
    kw_ids = [k.id for k in kw_res.scalars().all()]
    if not kw_ids:
        return {"days": days, "trend": []}

    rank_res = await db.execute(
        select(SEORanking)
        .where(
            SEORanking.keyword_id.in_(kw_ids),
            SEORanking.recorded_at >= cutoff,
        )
        .order_by(SEORanking.recorded_at.asc())
    )
    rankings = rank_res.scalars().all()

    # Bucket by date and compute avg CTR + total impressions.
    from collections import defaultdict
    buckets: dict[str, dict[str, float]] = defaultdict(lambda: {"impressions": 0.0, "clicks": 0.0, "n": 0.0})
    for r in rankings:
        if not r.recorded_at:
            continue
        key = r.recorded_at.date().isoformat()
        imp = getattr(r, "impressions", None) or 0
        clk = getattr(r, "clicks", None) or 0
        buckets[key]["impressions"] += float(imp)
        buckets[key]["clicks"] += float(clk)
        buckets[key]["n"] += 1

    trend = []
    for date, b in sorted(buckets.items()):
        imp = b["impressions"]
        clk = b["clicks"]
        ctr = round((clk / imp * 100), 2) if imp else 0.0
        trend.append({"date": date, "impressions": int(imp), "clicks": int(clk), "ctr_pct": ctr})

    return {"days": days, "trend": trend}
