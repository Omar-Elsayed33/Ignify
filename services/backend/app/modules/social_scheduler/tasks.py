"""Celery tasks for publishing scheduled social posts.

Per-platform logic lives in ``app.integrations.social.*``; this module is the
orchestrator: fetch the post row, resolve the connector via the registry,
delegate, and persist the result.

Concurrency model (P1-5):
- `scan_due_posts` issues a single atomic UPDATE that transitions rows from
  `scheduled → publishing` and RETURNing the ids it claimed. Only the Beat
  invocation that wins the row-level lock sees the id. Subsequent invocations
  (from a duplicate Beat, a crash-restart, or a second replica) see nothing
  and will not enqueue a duplicate task.
- `publish_scheduled_post` accepts rows in either `scheduled` or `publishing`
  state for backward compatibility, but the normal path is `publishing → published|failed`.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.db.models import SocialAccount, SocialPost, SocialPostStatus
from app.integrations.social import get_connector
from app.worker import celery_app

logger = logging.getLogger(__name__)

_CLAIMABLE_STATES = (SocialPostStatus.scheduled, SocialPostStatus.publishing)


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
            # Accept both `scheduled` (legacy path — task was enqueued before the
            # atomic claim landed) and `publishing` (normal path — scan_due_posts
            # already claimed this row for us). Anything else means someone beat
            # us to it or the post was canceled/failed; do nothing.
            if post.status not in _CLAIMABLE_STATES:
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
    """Atomically claim due posts and enqueue one publish task per claim.

    Race-safe by design: the UPDATE ... WHERE status='scheduled' RETURNING id
    uses PostgreSQL's row-level lock; only one concurrent caller sees each id.
    A duplicate Beat fire (or a second replica's Beat) runs the same UPDATE
    and gets back an empty result — no tasks enqueued, no duplicate publish.

    Stuck `publishing` rows: if a worker crashes after claiming but before
    transitioning to `published`/`failed`, the row stays `publishing`. That is
    acceptable for Phase 1 — the user can manually retry. Phase 2 adds a
    watchdog that times out stale `publishing` rows back to `failed`.
    """
    now = datetime.now(timezone.utc)
    engine, maker = _task_session_maker()
    try:
        async with maker() as db:
            # ATOMIC CLAIM: single UPDATE ... RETURNING id. Rows transition
            # scheduled → publishing in one statement. No SELECT-then-UPDATE
            # TOCTOU window.
            claim = await db.execute(
                update(SocialPost)
                .where(
                    and_(
                        SocialPost.status == SocialPostStatus.scheduled,
                        SocialPost.scheduled_at <= now,
                        SocialPost.publish_mode == "auto",
                    )
                )
                .values(status=SocialPostStatus.publishing)
                .returning(SocialPost.id)
                .execution_options(synchronize_session=False)
            )
            post_ids = [str(row[0]) for row in claim.all()]
            await db.commit()
    finally:
        await engine.dispose()

    if post_ids:
        logger.info("scan_due_posts claimed %d post(s): %s", len(post_ids), post_ids)
    for pid in post_ids:
        publish_scheduled_post.delay(pid)
    return {"enqueued": len(post_ids)}


@celery_app.task(bind=True, name="ignify.scan_due_posts")
def scan_due_posts(self) -> dict:
    return asyncio.run(_scan_due())
