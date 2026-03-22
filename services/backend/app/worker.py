from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "ignify",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)


@celery_app.task(bind=True, name="ignify.scheduled_post_publish")
def scheduled_post_publish(self, post_id: str) -> dict:
    """Publish a scheduled social media post."""
    import asyncio
    from uuid import UUID

    from sqlalchemy import select

    from app.db.database import async_session
    from app.db.models import SocialPost, SocialPostStatus

    async def _publish():
        async with async_session() as db:
            result = await db.execute(
                select(SocialPost).where(SocialPost.id == UUID(post_id))
            )
            post = result.scalar_one_or_none()
            if not post:
                return {"status": "error", "message": "Post not found"}

            # In production: call platform API to publish
            post.status = SocialPostStatus.published
            from datetime import datetime, timezone
            post.published_at = datetime.now(timezone.utc)
            await db.commit()
            return {"status": "published", "post_id": post_id}

    return asyncio.run(_publish())


@celery_app.task(bind=True, name="ignify.generate_report")
def generate_report(self, report_id: str, tenant_id: str) -> dict:
    """Generate an analytics report asynchronously."""
    import asyncio
    from uuid import UUID

    from sqlalchemy import select

    from app.db.database import async_session
    from app.db.models import Report, ReportSnapshot

    async def _generate():
        async with async_session() as db:
            result = await db.execute(
                select(Report).where(Report.id == UUID(report_id))
            )
            report = result.scalar_one_or_none()
            if not report:
                return {"status": "error", "message": "Report not found"}

            # In production: aggregate data, generate charts, etc.
            from datetime import date, timedelta
            snapshot = ReportSnapshot(
                report_id=report.id,
                data={"generated": True, "summary": "Auto-generated report"},
                period_start=date.today() - timedelta(days=30),
                period_end=date.today(),
            )
            db.add(snapshot)
            await db.commit()
            return {"status": "completed", "report_id": report_id}

    return asyncio.run(_generate())


@celery_app.task(bind=True, name="ignify.sync_ad_performance")
def sync_ad_performance(self, ad_account_id: str, tenant_id: str) -> dict:
    """Sync ad performance data from external ad platforms."""
    import asyncio
    from uuid import UUID

    from sqlalchemy import select

    from app.db.database import async_session
    from app.db.models import AdAccount, AdCampaign

    async def _sync():
        async with async_session() as db:
            result = await db.execute(
                select(AdAccount).where(AdAccount.id == UUID(ad_account_id))
            )
            account = result.scalar_one_or_none()
            if not account:
                return {"status": "error", "message": "Ad account not found"}

            campaigns = await db.execute(
                select(AdCampaign).where(AdCampaign.ad_account_id == account.id)
            )
            campaign_count = len(campaigns.scalars().all())

            # In production: call Google/Meta/Snapchat APIs to fetch performance data
            return {
                "status": "synced",
                "account_id": ad_account_id,
                "campaigns_synced": campaign_count,
            }

    return asyncio.run(_sync())


@celery_app.task(bind=True, name="ignify.sync_social_metrics")
def sync_social_metrics(self, social_account_id: str, tenant_id: str) -> dict:
    """Sync social media metrics from external platforms."""
    import asyncio
    from uuid import UUID

    from sqlalchemy import select

    from app.db.database import async_session
    from app.db.models import SocialAccount, SocialPost

    async def _sync():
        async with async_session() as db:
            result = await db.execute(
                select(SocialAccount).where(SocialAccount.id == UUID(social_account_id))
            )
            account = result.scalar_one_or_none()
            if not account:
                return {"status": "error", "message": "Social account not found"}

            posts = await db.execute(
                select(SocialPost).where(SocialPost.social_account_id == account.id)
            )
            post_count = len(posts.scalars().all())

            # In production: call platform APIs to fetch engagement metrics
            return {
                "status": "synced",
                "account_id": social_account_id,
                "posts_synced": post_count,
            }

    return asyncio.run(_sync())
