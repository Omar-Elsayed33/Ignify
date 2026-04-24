"""Phase 3 P3-4: approval-workflow enforcement at the scheduler boundary.

Scenarios covered (all against live Postgres):

1. Workflow OFF → unapproved ContentPost can still be scheduled (backward compat).
2. Workflow ON + ContentPost in draft → scheduling rejected (ValueError).
3. Workflow ON + ContentPost in approved → scheduling succeeds.
4. Workflow ON + scheduling without content_post_id → succeeds (raw posts unaffected).
5. Workflow ON + ContentPost.id unknown → scheduling rejected.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.db.models import (
    ContentPost,
    ContentStatus,
    PostType,
    SocialAccount,
    SocialPlatform,
    Tenant,
)


pytestmark = [pytest.mark.integration, pytest.mark.asyncio]


_TEST_TENANT_SLUG = "pytest-approval-tenant"


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
async def tenant(test_session) -> Tenant:
    result = await test_session.execute(
        text("SELECT id FROM tenants WHERE slug = :s"), {"s": _TEST_TENANT_SLUG}
    )
    row = result.first()
    if row:
        # Refetch as ORM object for mutation.
        res = await test_session.execute(
            text("SELECT * FROM tenants WHERE id = :id"), {"id": row.id}
        )
        tres = await test_session.execute(
            __import__("sqlalchemy").select(Tenant).where(Tenant.id == row.id)
        )
        t = tres.scalar_one()
        return t
    plan_res = await test_session.execute(text("SELECT id FROM plans LIMIT 1"))
    plan_row = plan_res.first()
    assert plan_row, "Need a seeded plan"
    t = Tenant(
        name="Pytest Approval", slug=_TEST_TENANT_SLUG, plan_id=plan_row.id, is_active=True
    )
    test_session.add(t)
    await test_session.commit()
    return t


@pytest.fixture
async def connected_account(test_session, tenant) -> SocialAccount:
    """A connected account so `publish_mode=auto` scheduling can succeed."""
    from app.core.crypto import encrypt_token
    acct = SocialAccount(
        tenant_id=tenant.id,
        platform=SocialPlatform.facebook,
        account_id="test-fb-page-1",
        name="Test Page",
        access_token_encrypted=encrypt_token("fake-access-token"),
        is_active=True,
    )
    test_session.add(acct)
    await test_session.commit()
    yield acct
    await test_session.execute(
        text("DELETE FROM social_accounts WHERE id = :id"), {"id": acct.id}
    )
    await test_session.commit()


@pytest.fixture(autouse=True)
async def reset_data(test_session, tenant):
    """Wipe posts + reset workflow before each test."""
    from copy import deepcopy
    await test_session.execute(
        text("DELETE FROM social_posts WHERE tenant_id = :t"), {"t": tenant.id}
    )
    await test_session.execute(
        text("DELETE FROM content_posts WHERE tenant_id = :t"), {"t": tenant.id}
    )
    cfg = deepcopy(tenant.config or {})
    cfg.setdefault("workflow", {})["approval_required"] = False
    tenant.config = cfg
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(tenant, "config")
    await test_session.commit()
    yield


async def _set_workflow(session, tenant, *, approval_required: bool):
    from copy import deepcopy
    from sqlalchemy.orm.attributes import flag_modified
    cfg = deepcopy(tenant.config or {})
    cfg.setdefault("workflow", {})["approval_required"] = approval_required
    tenant.config = cfg
    flag_modified(tenant, "config")
    await session.commit()


async def _make_content_post(session, tenant, status: ContentStatus) -> uuid.UUID:
    cp = ContentPost(
        tenant_id=tenant.id,
        title="Test",
        body="Body",
        post_type=PostType.social,
        status=status,
    )
    session.add(cp)
    await session.flush()
    pid = cp.id
    await session.commit()
    return pid


async def _schedule(session, tenant, *, content_post_id=None):
    from app.modules.social_scheduler.service import schedule_post
    return await schedule_post(
        session,
        tenant.id,
        platforms=["facebook"],
        scheduled_at=datetime.now(timezone.utc) + timedelta(hours=1),
        caption="test caption",
        media_urls=[],
        content_post_id=content_post_id,
        publish_mode="auto",
    )


class TestApprovalWorkflow:
    async def test_workflow_off_draft_content_schedules_fine(
        self, test_session, tenant, connected_account
    ):
        await _set_workflow(test_session, tenant, approval_required=False)
        cp_id = await _make_content_post(test_session, tenant, ContentStatus.draft)

        posts = await _schedule(test_session, tenant, content_post_id=cp_id)
        assert len(posts) == 1, "Workflow disabled — draft content should schedule"

    async def test_workflow_on_draft_content_rejected(
        self, test_session, tenant, connected_account
    ):
        await _set_workflow(test_session, tenant, approval_required=True)
        cp_id = await _make_content_post(test_session, tenant, ContentStatus.draft)

        with pytest.raises(ValueError, match="content_not_approved"):
            await _schedule(test_session, tenant, content_post_id=cp_id)

    async def test_workflow_on_review_content_rejected(
        self, test_session, tenant, connected_account
    ):
        """Content in `review` state also isn't approved yet — must be blocked."""
        await _set_workflow(test_session, tenant, approval_required=True)
        cp_id = await _make_content_post(test_session, tenant, ContentStatus.review)

        with pytest.raises(ValueError, match="content_not_approved"):
            await _schedule(test_session, tenant, content_post_id=cp_id)

    async def test_workflow_on_rejected_content_rejected(
        self, test_session, tenant, connected_account
    ):
        """`rejected` status definitely cannot be scheduled."""
        await _set_workflow(test_session, tenant, approval_required=True)
        cp_id = await _make_content_post(test_session, tenant, ContentStatus.rejected)

        with pytest.raises(ValueError, match="content_not_approved"):
            await _schedule(test_session, tenant, content_post_id=cp_id)

    async def test_workflow_on_approved_content_schedules(
        self, test_session, tenant, connected_account
    ):
        await _set_workflow(test_session, tenant, approval_required=True)
        cp_id = await _make_content_post(test_session, tenant, ContentStatus.approved)

        posts = await _schedule(test_session, tenant, content_post_id=cp_id)
        assert len(posts) == 1

    async def test_workflow_on_no_content_post_allowed(
        self, test_session, tenant, connected_account
    ):
        """Raw scheduling (no content_post_id, just caption+media) is unaffected.

        The workflow governs GENERATED content; direct scheduling by a human
        writing their own caption doesn't flow through the approval system.
        """
        await _set_workflow(test_session, tenant, approval_required=True)
        posts = await _schedule(test_session, tenant, content_post_id=None)
        assert len(posts) == 1

    async def test_workflow_on_unknown_content_post_rejected(
        self, test_session, tenant, connected_account
    ):
        await _set_workflow(test_session, tenant, approval_required=True)
        with pytest.raises(ValueError, match="content_post_not_found"):
            await _schedule(test_session, tenant, content_post_id=uuid.uuid4())
