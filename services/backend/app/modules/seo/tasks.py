"""Celery tasks for SEO rank tracking."""
from __future__ import annotations

import asyncio
import logging
from datetime import date as _date

from sqlalchemy import select

from app.core.seo import find_ranking
from app.db.database import async_session
from app.db.models import SEOKeyword, SEORanking
from app.worker import celery_app

log = logging.getLogger(__name__)


@celery_app.task(bind=True, name="ignify.daily_rank_sync")
def daily_rank_sync(self) -> dict:
    """Iterate all tracked keywords and store a fresh SERP ranking row."""

    async def _run() -> dict:
        checked = 0
        updated = 0
        async with async_session() as db:
            rows = (await db.execute(select(SEOKeyword))).scalars().all()
            for kw in rows:
                target = (kw.target_url or "")
                domain = target.replace("https://", "").replace("http://", "").split("/")[0]
                if not domain:
                    continue
                try:
                    info = await find_ranking(
                        kw.keyword,
                        domain,
                        location=kw.location or "Egypt",
                        hl=kw.language or "ar",
                    )
                except Exception as e:  # noqa: BLE001
                    log.warning("rank check failed for %s: %s", kw.keyword, e)
                    continue
                checked += 1
                position = info.get("position")
                ranking = SEORanking(
                    keyword_id=kw.id,
                    rank=position or 0,
                    url=info.get("url"),
                    title=info.get("title"),
                    serp_features=info.get("serp_features") or [],
                    date=_date.today(),
                )
                db.add(ranking)
                if position is not None:
                    kw.current_rank = position
                    updated += 1
            await db.commit()
        return {"checked": checked, "updated": updated}

    return asyncio.run(_run())
