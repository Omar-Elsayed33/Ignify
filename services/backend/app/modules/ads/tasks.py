"""Celery tasks for Meta Ads insights sync."""
from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.db.models import AdCampaign, AdPlatform
from app.modules.ads import service as ads_service
from app.worker import celery_app

log = logging.getLogger(__name__)


def _task_session_maker():
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool, echo=False)
    return engine, async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def _sync_all() -> dict:
    engine, maker = _task_session_maker()
    synced = 0
    errors = 0
    try:
        async with maker() as db:
            rows = await db.execute(
                select(AdCampaign).where(
                    AdCampaign.platform == AdPlatform.meta,
                    AdCampaign.status.in_(["active", "paused"]),
                    AdCampaign.campaign_id_external.isnot(None),
                )
            )
            campaigns = rows.scalars().all()
            for c in campaigns:
                try:
                    await ads_service.fetch_and_cache_insights(
                        db, tenant_id=c.tenant_id, campaign_id=c.id
                    )
                    synced += 1
                except Exception as exc:  # noqa: BLE001
                    log.warning("sync insights failed for %s: %s", c.id, exc)
                    errors += 1
            await db.commit()
    finally:
        await engine.dispose()
    return {"synced": synced, "errors": errors}


@celery_app.task(bind=True, name="ignify.sync_ad_insights")
def sync_ad_insights(self) -> dict:
    """Iterate active Meta ad campaigns and refresh their insights."""
    return asyncio.run(_sync_all())
