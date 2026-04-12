"""Celery tasks for competitor snapshots."""
from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from app.core.competitor_scraper import scrape_public_page
from app.db.database import async_session
from app.db.models import Competitor, CompetitorSnapshot
from app.worker import celery_app

log = logging.getLogger(__name__)


@celery_app.task(bind=True, name="ignify.daily_competitor_snapshot")
def daily_competitor_snapshot(self) -> dict:
    """Iterate competitors, scrape public pages, store a snapshot row."""

    async def _run() -> dict:
        n = 0
        async with async_session() as db:
            comps = (await db.execute(select(Competitor))).scalars().all()
            for c in comps:
                urls = [
                    u for u in [
                        c.website,
                        c.instagram_url,
                        c.facebook_url,
                        c.twitter_url,
                        c.linkedin_url,
                        c.tiktok_url,
                        c.youtube_url,
                    ] if u
                ]
                scraped = []
                for u in urls[:10]:
                    try:
                        scraped.append(await scrape_public_page(u))
                    except Exception as e:  # noqa: BLE001
                        log.info("scrape failed for %s: %s", u, e)
                snap = CompetitorSnapshot(
                    competitor_id=c.id,
                    data={"scraped": scraped, "url_count": len(scraped)},
                    snapshot_type="daily_scrape",
                )
                db.add(snap)
                n += 1
            await db.commit()
        return {"competitors_snapshotted": n}

    return asyncio.run(_run())
