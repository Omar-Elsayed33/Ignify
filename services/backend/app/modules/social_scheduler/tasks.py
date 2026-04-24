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
from datetime import datetime, timedelta, timezone
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


@celery_app.task(
    bind=True,
    name="ignify.publish_scheduled_post",
    # Retry transient failures (platform 5xx, network blips, rate limits) with
    # exponential backoff. Task-level exceptions that should NOT retry (e.g.
    # invalid token, deleted page) are logged and the row goes to `failed` via
    # the try/except in `_publish_async`, bypassing autoretry.
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=True,        # start at 1s, double up to retry_backoff_max
    retry_backoff_max=600,     # cap at 10 min
    retry_jitter=True,
    max_retries=3,
    # A single publish should never take longer than 2 min even for LinkedIn
    # multi-image uploads. time_limit hard-kills beyond that.
    time_limit=180,
    soft_time_limit=120,
)
def publish_scheduled_post(self, post_id: str) -> dict:
    return asyncio.run(_publish_async(post_id))


async def _scan_due(tenant_id: UUID | None = None) -> dict:
    """Atomically claim due posts and enqueue one publish task per claim.

    Race-safe by design: the UPDATE ... WHERE status='scheduled' RETURNING id
    uses PostgreSQL's row-level lock; only one concurrent caller sees each id.
    A duplicate Beat fire (or a second replica's Beat) runs the same UPDATE
    and gets back an empty result — no tasks enqueued, no duplicate publish.

    Parameters
    ----------
    tenant_id : UUID | None
        When set, the scan is scoped to a single tenant. Used by the
        integration tests so they don't race with the always-running Beat
        container. When None (the Beat-invoked path), we exclude any tenant
        whose slug starts with ``pytest-`` — that keeps test rows off Beat's
        radar without needing env var coordination. No production tenant
        should ever have a ``pytest-`` slug.
    """
    now = datetime.now(timezone.utc)
    engine, maker = _task_session_maker()
    try:
        async with maker() as db:
            # Base where-clause: due, scheduled, auto-mode.
            where_clause = and_(
                SocialPost.status == SocialPostStatus.scheduled,
                SocialPost.scheduled_at <= now,
                SocialPost.publish_mode == "auto",
            )
            if tenant_id is not None:
                # Test-scoped path — only this tenant's rows.
                where_clause = and_(where_clause, SocialPost.tenant_id == tenant_id)
            else:
                # Beat path — exclude pytest tenants so integration tests
                # that manipulate the scheduler from a dedicated tenant
                # don't collide with Beat's 60-second ticks.
                from app.db.models import Tenant as _Tenant
                from sqlalchemy import select as _select
                pytest_tenants_subq = (
                    _select(_Tenant.id).where(_Tenant.slug.like("pytest-%"))
                ).scalar_subquery()
                where_clause = and_(
                    where_clause, SocialPost.tenant_id.notin_(pytest_tenants_subq)
                )

            claim = await db.execute(
                update(SocialPost)
                .where(where_clause)
                .values(
                    status=SocialPostStatus.publishing,
                    # Stamp so reap_stuck_publishing can age rows out if the
                    # worker that claimed them crashes before producing an outcome.
                    publishing_started_at=now,
                )
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


# ── Stuck-publishing watchdog (P2-4) ──────────────────────────────────────────
# A post enters `publishing` when scan_due_posts claims it. The worker then
# either moves it to `published` (success) or `failed` (API error). But if the
# worker itself dies mid-publish (OOM, pod evicted, container killed), the row
# stays in `publishing` indefinitely and disappears from the user's calendar.
# The watchdog ages these rows out every 5 min so the user gets a visible
# failure and can retry.
_STUCK_THRESHOLD_MINUTES = 15


async def _reap_stuck_async(tenant_id: UUID | None = None) -> dict:
    """Move rows stuck in `publishing` state older than the threshold back to `failed`.

    Same Beat-vs-test isolation pattern as ``_scan_due``: when called from
    Beat (``tenant_id=None``), we exclude any tenant whose slug starts with
    ``pytest-`` so integration tests own their rows exclusively. Tests pass
    their fixture's tenant.id explicitly.

    Conservative: only considers rows that were claimed (publishing_started_at
    set). Updates atomically using a single UPDATE ... RETURNING so we can log
    the exact rows that were rescued. Idempotent — running this twice is safe.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=_STUCK_THRESHOLD_MINUTES)
    engine, maker = _task_session_maker()
    try:
        async with maker() as db:
            where_clause = and_(
                SocialPost.status == SocialPostStatus.publishing,
                SocialPost.publishing_started_at.is_not(None),
                SocialPost.publishing_started_at < cutoff,
            )
            if tenant_id is not None:
                where_clause = and_(where_clause, SocialPost.tenant_id == tenant_id)
            else:
                from app.db.models import Tenant as _Tenant
                from sqlalchemy import select as _select
                pytest_tenants_subq = (
                    _select(_Tenant.id).where(_Tenant.slug.like("pytest-%"))
                ).scalar_subquery()
                where_clause = and_(
                    where_clause, SocialPost.tenant_id.notin_(pytest_tenants_subq)
                )

            result = await db.execute(
                update(SocialPost)
                .where(where_clause)
                .values(status=SocialPostStatus.failed)
                .returning(SocialPost.id)
                .execution_options(synchronize_session=False)
            )
            reaped = [str(row[0]) for row in result.all()]
            await db.commit()
    finally:
        await engine.dispose()
    if reaped:
        logger.warning(
            "reap_stuck_publishing: moved %d stuck rows back to failed: %s",
            len(reaped),
            reaped,
        )
    return {"reaped": len(reaped), "post_ids": reaped}


@celery_app.task(
    bind=True,
    name="ignify.reap_stuck_publishing",
    time_limit=60,
    soft_time_limit=45,
)
def reap_stuck_publishing(self) -> dict:
    return asyncio.run(_reap_stuck_async())
