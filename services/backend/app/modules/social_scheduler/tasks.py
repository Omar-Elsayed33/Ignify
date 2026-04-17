"""Celery tasks for publishing scheduled social posts.

Per-platform logic lives in ``app.integrations.social.*``; this module is the
orchestrator: fetch the post row, resolve the connector via the registry,
delegate, and persist the result.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.db.models import SocialAccount, SocialPost, SocialPostStatus
from app.integrations.social import get_connector
from app.worker import celery_app


def _task_session_maker():
    """Fresh engine per Celery task — avoids asyncpg 'another operation in progress'
    caused by pool connections being shared across Celery's forked workers."""
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool, echo=False)
    return engine, async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def _publish_async(post_id: str) -> dict:
    engine, maker = _task_session_maker()
    try:
        async with maker() as db:
            result = await db.execute(
                select(SocialPost).where(SocialPost.id == UUID(post_id))
            )
            post = result.scalar_one_or_none()
            if not post:
                return {"status": "error", "message": "Post not found"}
            if post.status != SocialPostStatus.scheduled:
                return {"status": "skipped", "reason": f"status={post.status}"}

            acct_row = await db.execute(
                select(SocialAccount).where(SocialAccount.id == post.social_account_id)
            )
            acct = acct_row.scalar_one_or_none()
            if not acct or not acct.access_token_encrypted:
                post.status = SocialPostStatus.failed
                await db.commit()
                return {"status": "error", "message": "Missing account or token"}

            connector = get_connector(acct.platform)
            if connector is None:
                post.status = SocialPostStatus.failed
                await db.commit()
                return {"status": "error", "message": f"Unsupported platform: {acct.platform}"}

            try:
                outcome = await connector.publish(
                    acct,
                    post.content,
                    list(post.media_urls or []),
                )
                post.status = SocialPostStatus.published
                post.external_post_id = outcome.external_id
                post.published_at = datetime.now(timezone.utc)
                await db.commit()
                return {"status": "published", "external_id": outcome.external_id}
            except Exception as exc:  # noqa: BLE001
                post.status = SocialPostStatus.failed
                await db.commit()
                return {"status": "failed", "error": str(exc)}
    finally:
        await engine.dispose()


@celery_app.task(bind=True, name="ignify.publish_scheduled_post")
def publish_scheduled_post(self, post_id: str) -> dict:
    return asyncio.run(_publish_async(post_id))


async def _scan_due() -> dict:
    now = datetime.now(timezone.utc)
    engine, maker = _task_session_maker()
    try:
        async with maker() as db:
            rows = await db.execute(
                select(SocialPost).where(
                    and_(
                        SocialPost.status == SocialPostStatus.scheduled,
                        SocialPost.scheduled_at <= now,
                        SocialPost.publish_mode == "auto",
                    )
                )
            )
            posts = rows.scalars().all()
            post_ids = [str(p.id) for p in posts]
    finally:
        await engine.dispose()

    for pid in post_ids:
        publish_scheduled_post.delay(pid)
    return {"enqueued": len(post_ids)}


@celery_app.task(bind=True, name="ignify.scan_due_posts")
def scan_due_posts(self) -> dict:
    return asyncio.run(_scan_due())
