"""Celery tasks for periodic analytics snapshots."""
from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from app.worker import celery_app

logger = logging.getLogger(__name__)


async def _fetch_platform_insights(account) -> dict:
    """Stub: call Meta Graph API (or other) for page insights.

    In production this would hit the platform SDK using
    `account.access_token_encrypted` (after decryption). For now we return
    empty counters so the upsert still happens deterministically.
    """
    if not account.access_token_encrypted:
        return {"reach": 0, "impressions": 0, "engagements": 0}
    # TODO: real Meta/Graph fetch here.
    return {"reach": 0, "impressions": 0, "engagements": 0}


async def _snapshot_tenant(db, tenant) -> dict:
    from app.db.models import (
        Report,
        ReportSnapshot,
        SocialAccount,
        SocialMetric,
        SocialPost,
    )

    today = date.today()
    window_end = datetime.now(timezone.utc)
    window_start = window_end - timedelta(days=1)

    accounts = (
        await db.execute(
            select(SocialAccount).where(
                SocialAccount.tenant_id == tenant.id,
                SocialAccount.is_active == True,  # noqa: E712
            )
        )
    ).scalars().all()

    totals = {"reach": 0, "impressions": 0, "engagements": 0, "posts": 0}

    for account in accounts:
        insights = await _fetch_platform_insights(account)
        posts = (
            await db.execute(
                select(SocialPost).where(
                    SocialPost.social_account_id == account.id,
                    SocialPost.tenant_id == tenant.id,
                )
            )
        ).scalars().all()

        per_post_reach = (
            insights["reach"] // max(len(posts), 1) if posts else 0
        )
        per_post_impr = (
            insights["impressions"] // max(len(posts), 1) if posts else 0
        )
        per_post_eng = (
            insights["engagements"] // max(len(posts), 1) if posts else 0
        )

        for post in posts:
            metric = SocialMetric(
                social_post_id=post.id,
                likes=per_post_eng // 3,
                comments=per_post_eng // 3,
                shares=per_post_eng - 2 * (per_post_eng // 3),
                impressions=per_post_impr,
                reach=per_post_reach,
                recorded_at=window_end,
            )
            db.add(metric)
            totals["posts"] += 1

        totals["reach"] += insights["reach"]
        totals["impressions"] += insights["impressions"]
        totals["engagements"] += insights["engagements"]

    # Aggregated ReportSnapshot row (attached to any existing "daily" report
    # or created opportunistically — we simply pick/create a daily report).
    daily_report = (
        await db.execute(
            select(Report).where(
                Report.tenant_id == tenant.id,
                Report.report_type == "daily_snapshot",
            ).limit(1)
        )
    ).scalar_one_or_none()

    if daily_report is None:
        daily_report = Report(
            tenant_id=tenant.id,
            name="Daily Analytics Snapshot",
            report_type="daily_snapshot",
            config={"auto": True},
        )
        db.add(daily_report)
        await db.flush()

    snapshot = ReportSnapshot(
        report_id=daily_report.id,
        data=totals,
        period_start=today,
        period_end=today,
    )
    db.add(snapshot)

    await db.commit()
    logger.info(
        "snapshot_daily_metrics: tenant=%s totals=%s", tenant.id, totals
    )
    return {"tenant_id": str(tenant.id), **totals}


@celery_app.task(bind=True, name="ignify.snapshot_daily_metrics")
def snapshot_daily_metrics(self) -> dict:
    """Iterate active tenants and upsert daily analytics snapshots."""
    from app.db.database import async_session
    from app.db.models import Tenant

    async def _run():
        results = []
        async with async_session() as db:
            tenants = (
                await db.execute(
                    select(Tenant).where(Tenant.is_active == True)  # noqa: E712
                )
            ).scalars().all()
            for tenant in tenants:
                try:
                    results.append(await _snapshot_tenant(db, tenant))
                except Exception as exc:  # pragma: no cover
                    logger.exception(
                        "snapshot_daily_metrics failed for tenant %s: %s",
                        tenant.id,
                        exc,
                    )
                    await db.rollback()
        return {"status": "ok", "tenants": len(results), "results": results}

    return asyncio.run(_run())


# Register the beat schedule entry so Celery Beat picks it up.
celery_app.conf.beat_schedule = {
    **(celery_app.conf.beat_schedule or {}),
    "snapshot-daily-metrics": {
        "task": "ignify.snapshot_daily_metrics",
        "schedule": 60 * 60 * 24,  # fallback interval
        "options": {"expires": 60 * 60 * 12},
    },
}

# Crontab: 01:00 UTC daily (imported lazily to avoid hard celery.schedules dep
# issues in contexts where only the module is imported for reflection).
try:  # pragma: no cover
    from celery.schedules import crontab

    celery_app.conf.beat_schedule["snapshot-daily-metrics"]["schedule"] = crontab(
        hour=1, minute=0
    )
except Exception:  # pragma: no cover
    pass
