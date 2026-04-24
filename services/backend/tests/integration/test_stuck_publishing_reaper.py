"""P2-4: Stuck-publishing watchdog integration test.

Covers:
- A row in `publishing` older than the threshold is moved to `failed`.
- A row in `publishing` younger than the threshold is left alone.
- A row in `published` or `scheduled` is never touched.
- publishing_started_at must be set — rows without it are ignored.
- Running the watchdog twice in a row is idempotent.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.db.models import SocialPost, SocialPostStatus, Tenant


pytestmark = [pytest.mark.integration, pytest.mark.asyncio]


_TEST_TENANT_SLUG = "pytest-reaper-tenant"


@pytest.fixture
async def test_session() -> AsyncSession:
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool, echo=False)
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        async with maker() as session:
            yield session
    finally:
        await engine.dispose()


@pytest.fixture
async def tenant_id(test_session) -> uuid.UUID:
    result = await test_session.execute(
        text("SELECT id FROM tenants WHERE slug = :s"), {"s": _TEST_TENANT_SLUG}
    )
    row = result.first()
    if row:
        return row.id
    plan_result = await test_session.execute(text("SELECT id FROM plans LIMIT 1"))
    plan_row = plan_result.first()
    assert plan_row, "No plans seeded; cannot create test tenant"
    t = Tenant(
        name="Pytest Reaper", slug=_TEST_TENANT_SLUG, plan_id=plan_row.id, is_active=True
    )
    test_session.add(t)
    await test_session.commit()
    return t.id


@pytest.fixture
async def clean_posts(test_session, tenant_id):
    await test_session.execute(
        text("DELETE FROM social_posts WHERE tenant_id = :t"), {"t": tenant_id}
    )
    await test_session.commit()
    yield
    await test_session.execute(
        text("DELETE FROM social_posts WHERE tenant_id = :t"), {"t": tenant_id}
    )
    await test_session.commit()


async def _make_publishing_post(
    session: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    publishing_started_at: datetime | None,
) -> uuid.UUID:
    post = SocialPost(
        tenant_id=tenant_id,
        content="watchdog test",
        status=SocialPostStatus.publishing,
        publish_mode="auto",
        scheduled_at=datetime.now(timezone.utc) - timedelta(hours=1),
        publishing_started_at=publishing_started_at,
    )
    session.add(post)
    await session.flush()
    pid = post.id
    await session.commit()
    return pid


class TestReapStuckPublishing:
    async def test_old_publishing_row_reaped(
        self, test_session, tenant_id, clean_posts
    ):
        from app.modules.social_scheduler.tasks import _reap_stuck_async

        # 30 minutes ago — well past the 15-min threshold.
        pid = await _make_publishing_post(
            test_session,
            tenant_id,
            publishing_started_at=datetime.now(timezone.utc) - timedelta(minutes=30),
        )
        result = await _reap_stuck_async(tenant_id=tenant_id)

        assert result["reaped"] == 1
        assert str(pid) in result["post_ids"]

        # Verify status transitioned to failed in DB.
        check = await test_session.execute(
            text("SELECT status FROM social_posts WHERE id = :id"), {"id": pid}
        )
        assert check.first().status == "failed"

    async def test_recent_publishing_row_left_alone(
        self, test_session, tenant_id, clean_posts
    ):
        from app.modules.social_scheduler.tasks import _reap_stuck_async

        # 2 minutes ago — still within threshold.
        pid = await _make_publishing_post(
            test_session,
            tenant_id,
            publishing_started_at=datetime.now(timezone.utc) - timedelta(minutes=2),
        )
        result = await _reap_stuck_async(tenant_id=tenant_id)
        assert result["reaped"] == 0

        check = await test_session.execute(
            text("SELECT status FROM social_posts WHERE id = :id"), {"id": pid}
        )
        assert check.first().status == "publishing"

    async def test_row_without_timestamp_not_reaped(
        self, test_session, tenant_id, clean_posts
    ):
        """Defensive: a row might be in `publishing` but have no timestamp
        (legacy row, or a bug). We'd rather leak than delete data so we leave
        it alone — ops can inspect and manually fix."""
        from app.modules.social_scheduler.tasks import _reap_stuck_async

        pid = await _make_publishing_post(
            test_session, tenant_id, publishing_started_at=None
        )
        result = await _reap_stuck_async(tenant_id=tenant_id)
        assert result["reaped"] == 0

        check = await test_session.execute(
            text("SELECT status FROM social_posts WHERE id = :id"), {"id": pid}
        )
        assert check.first().status == "publishing"

    async def test_published_and_scheduled_rows_untouched(
        self, test_session, tenant_id, clean_posts
    ):
        from app.modules.social_scheduler.tasks import _reap_stuck_async

        # Published + 30min old publishing_started_at (stale, but status is final)
        published = SocialPost(
            tenant_id=tenant_id,
            content="already published",
            status=SocialPostStatus.published,
            publish_mode="auto",
            scheduled_at=datetime.now(timezone.utc) - timedelta(hours=1),
            publishing_started_at=datetime.now(timezone.utc) - timedelta(minutes=30),
        )
        scheduled = SocialPost(
            tenant_id=tenant_id,
            content="waiting",
            status=SocialPostStatus.scheduled,
            publish_mode="auto",
            scheduled_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        test_session.add_all([published, scheduled])
        await test_session.commit()

        result = await _reap_stuck_async(tenant_id=tenant_id)
        assert result["reaped"] == 0

    async def test_idempotent_on_second_run(
        self, test_session, tenant_id, clean_posts
    ):
        from app.modules.social_scheduler.tasks import _reap_stuck_async

        pid = await _make_publishing_post(
            test_session,
            tenant_id,
            publishing_started_at=datetime.now(timezone.utc) - timedelta(minutes=30),
        )
        first = await _reap_stuck_async(tenant_id=tenant_id)
        second = await _reap_stuck_async(tenant_id=tenant_id)
        assert first["reaped"] == 1
        assert second["reaped"] == 0  # already moved to failed
        assert str(pid) in first["post_ids"]
        assert str(pid) not in second["post_ids"]
