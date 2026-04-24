"""P1-5: Integration test for the atomic scheduler claim.

Verifies the double-publish race condition is closed. Requires a live PostgreSQL
instance (uses the same DATABASE_URL as the app). Run in the backend container:

    pytest tests/integration/test_scheduler_claim.py -v

What this proves:
- Two concurrent `_scan_due()` calls never claim the same post.
- After a scan, claimed posts are in `publishing` state and are NOT re-claimed
  on the next scan.
- Non-claimable rows (draft, published, failed, manual mode, future-scheduled)
  are never claimed.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.db.models import SocialPost, SocialPostStatus, Tenant


pytestmark = [pytest.mark.integration, pytest.mark.asyncio]


# Test tenant is created/reused per session so we can isolate our rows.
_TEST_TENANT_NAME = "pytest-scheduler-claim-tenant"


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
    """Create or reuse a dedicated test tenant. Cleaned up between runs by
    matching on the unique slug."""
    from app.db.models import Plan
    result = await test_session.execute(
        text("SELECT id FROM tenants WHERE slug = :s"),
        {"s": _TEST_TENANT_NAME},
    )
    row = result.first()
    if row:
        return row.id

    # Need a plan_id — use the first available.
    plan_result = await test_session.execute(text("SELECT id FROM plans LIMIT 1"))
    plan_row = plan_result.first()
    assert plan_row, "No plans seeded; cannot create test tenant"

    t = Tenant(
        name="Pytest Scheduler Claim",
        slug=_TEST_TENANT_NAME,
        plan_id=plan_row.id,
        is_active=True,
    )
    test_session.add(t)
    await test_session.commit()
    return t.id


@pytest.fixture
async def clean_test_posts(test_session, tenant_id):
    """Remove any scheduler-test posts left over from prior runs."""
    await test_session.execute(
        text("DELETE FROM social_posts WHERE tenant_id = :t"),
        {"t": tenant_id},
    )
    await test_session.commit()
    yield
    await test_session.execute(
        text("DELETE FROM social_posts WHERE tenant_id = :t"),
        {"t": tenant_id},
    )
    await test_session.commit()


async def _make_post(
    session: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    status: SocialPostStatus = SocialPostStatus.scheduled,
    publish_mode: str = "auto",
    scheduled_at: datetime | None = None,
) -> uuid.UUID:
    post = SocialPost(
        tenant_id=tenant_id,
        content="test content",
        status=status,
        publish_mode=publish_mode,
        scheduled_at=scheduled_at or (datetime.now(timezone.utc) - timedelta(minutes=1)),
    )
    session.add(post)
    await session.flush()
    pid = post.id
    await session.commit()
    return pid


class TestAtomicClaim:
    async def test_claim_transitions_scheduled_to_publishing(
        self, test_session, tenant_id, clean_test_posts
    ):
        # Seed 3 due posts.
        from app.modules.social_scheduler.tasks import _scan_due

        ids = []
        for _ in range(3):
            ids.append(await _make_post(test_session, tenant_id))

        # Patch delay() so we don't actually enqueue Celery tasks.
        with patch(
            "app.modules.social_scheduler.tasks.publish_scheduled_post.delay"
        ) as fake_delay:
            result = await _scan_due(tenant_id=tenant_id)

        assert result["enqueued"] == 3
        assert fake_delay.call_count == 3

        # Verify: all 3 rows are now in `publishing` state.
        rows = await test_session.execute(
            text(
                "SELECT id, status FROM social_posts WHERE tenant_id = :t ORDER BY id"
            ),
            {"t": tenant_id},
        )
        records = list(rows)
        assert len(records) == 3
        assert all(r.status == "publishing" for r in records), \
            f"Expected all publishing, got: {[(r.id, r.status) for r in records]}"

    async def test_second_scan_claims_nothing_after_first(
        self, test_session, tenant_id, clean_test_posts
    ):
        from app.modules.social_scheduler.tasks import _scan_due

        await _make_post(test_session, tenant_id)

        with patch(
            "app.modules.social_scheduler.tasks.publish_scheduled_post.delay"
        ) as fake_delay:
            first = await _scan_due(tenant_id=tenant_id)
            second = await _scan_due(tenant_id=tenant_id)

        assert first["enqueued"] == 1
        assert second["enqueued"] == 0, \
            "Second scan re-claimed a post that was already `publishing`"
        assert fake_delay.call_count == 1

    async def test_concurrent_scans_never_double_claim(
        self, test_session, tenant_id, clean_test_posts
    ):
        """The critical test: simulate two Beat fires happening at the same time.
        Across both calls, each post_id must appear in exactly ONE enqueued list."""
        from app.modules.social_scheduler.tasks import _scan_due

        # Seed 5 posts.
        for _ in range(5):
            await _make_post(test_session, tenant_id)

        enqueued_in_a: list[str] = []
        enqueued_in_b: list[str] = []

        def capture_a(pid):
            enqueued_in_a.append(pid)

        def capture_b(pid):
            enqueued_in_b.append(pid)

        # Run two scans concurrently; each captures its own enqueues.
        async def scan_with_capture(capture):
            with patch(
                "app.modules.social_scheduler.tasks.publish_scheduled_post.delay",
                side_effect=capture,
            ):
                return await _scan_due(tenant_id=tenant_id)

        a, b = await asyncio.gather(
            scan_with_capture(capture_a),
            scan_with_capture(capture_b),
        )

        # Every post must be claimed by exactly one scan — no duplicates.
        all_claimed = set(enqueued_in_a) | set(enqueued_in_b)
        intersection = set(enqueued_in_a) & set(enqueued_in_b)
        assert intersection == set(), \
            f"Double-claim detected! Same id claimed by both scans: {intersection}"
        assert len(all_claimed) == 5, \
            f"Expected 5 claims total, got {len(all_claimed)} ({a=} {b=})"
        assert len(enqueued_in_a) + len(enqueued_in_b) == 5

    async def test_manual_mode_never_claimed(
        self, test_session, tenant_id, clean_test_posts
    ):
        from app.modules.social_scheduler.tasks import _scan_due

        # A manual-mode post due 1 min ago — must NOT be auto-published.
        await _make_post(test_session, tenant_id, publish_mode="manual")

        with patch(
            "app.modules.social_scheduler.tasks.publish_scheduled_post.delay"
        ) as fake_delay:
            result = await _scan_due(tenant_id=tenant_id)

        assert result["enqueued"] == 0
        fake_delay.assert_not_called()

    async def test_future_scheduled_never_claimed(
        self, test_session, tenant_id, clean_test_posts
    ):
        from app.modules.social_scheduler.tasks import _scan_due

        future = datetime.now(timezone.utc) + timedelta(hours=1)
        await _make_post(test_session, tenant_id, scheduled_at=future)

        with patch(
            "app.modules.social_scheduler.tasks.publish_scheduled_post.delay"
        ) as fake_delay:
            result = await _scan_due(tenant_id=tenant_id)

        assert result["enqueued"] == 0
        fake_delay.assert_not_called()

    async def test_draft_never_claimed(
        self, test_session, tenant_id, clean_test_posts
    ):
        from app.modules.social_scheduler.tasks import _scan_due

        await _make_post(
            test_session, tenant_id, status=SocialPostStatus.draft
        )
        with patch(
            "app.modules.social_scheduler.tasks.publish_scheduled_post.delay"
        ) as fake_delay:
            result = await _scan_due(tenant_id=tenant_id)
        assert result["enqueued"] == 0
        fake_delay.assert_not_called()

    async def test_already_published_never_reclaimed(
        self, test_session, tenant_id, clean_test_posts
    ):
        from app.modules.social_scheduler.tasks import _scan_due

        await _make_post(
            test_session, tenant_id, status=SocialPostStatus.published
        )
        with patch(
            "app.modules.social_scheduler.tasks.publish_scheduled_post.delay"
        ) as fake_delay:
            result = await _scan_due(tenant_id=tenant_id)
        assert result["enqueued"] == 0
        fake_delay.assert_not_called()
