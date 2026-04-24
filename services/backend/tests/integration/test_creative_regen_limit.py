"""Phase 8 P4: regen-limit guard integration tests.

Verifies:
- 0 existing creatives → allowed.
- 1 existing → allowed (the one regen you get).
- 2 existing (MAX) → RegenLimitExceeded raised.
- content_post_id=None is never counted (standalone creatives unlimited).
- Counting filters by tenant + post_id, not by prompt text.
"""
from __future__ import annotations

import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.db.models import AssetType, CreativeAsset, Tenant
from app.modules.creative_gen.regen_guard import (
    MAX_GENERATIONS_PER_POST,
    RegenLimitExceeded,
    check_regen_limit,
    count_existing_creatives_for_post,
)


pytestmark = [pytest.mark.integration, pytest.mark.asyncio]


_TEST_SLUG = "pytest-creative-regen-tenant"


@pytest.fixture
async def session() -> AsyncSession:
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool, echo=False)
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        async with maker() as s:
            yield s
    finally:
        await engine.dispose()


@pytest.fixture
async def tenant(session):
    row = (await session.execute(
        text("SELECT id FROM tenants WHERE slug = :s"), {"s": _TEST_SLUG}
    )).first()
    if row:
        await session.execute(
            text("DELETE FROM creative_assets WHERE tenant_id = :t"), {"t": row.id}
        )
        tres = await session.execute(
            __import__("sqlalchemy").select(Tenant).where(Tenant.id == row.id)
        )
        t = tres.scalar_one()
    else:
        plan_row = (await session.execute(text("SELECT id FROM plans LIMIT 1"))).first()
        t = Tenant(
            name="Creative Regen Tenant",
            slug=_TEST_SLUG,
            plan_id=plan_row.id,
            is_active=True,
        )
        session.add(t)
    await session.commit()
    yield t
    await session.execute(
        text("DELETE FROM creative_assets WHERE tenant_id = :t"), {"t": t.id}
    )
    await session.commit()


async def _insert_creative(session, tenant, content_post_id: uuid.UUID | None) -> None:
    asset = CreativeAsset(
        tenant_id=tenant.id,
        name="test",
        asset_type=AssetType.image,
        file_url="https://example.com/x.jpg",
        prompt_used="test prompt",
        metadata_={
            "content_post_id": str(content_post_id) if content_post_id else None,
        },
    )
    session.add(asset)
    await session.commit()


class TestRegenLimit:
    async def test_zero_existing_allowed(self, session, tenant):
        post_id = uuid.uuid4()
        count = await check_regen_limit(session, tenant.id, post_id)
        assert count == 0

    async def test_one_existing_still_allowed(self, session, tenant):
        post_id = uuid.uuid4()
        await _insert_creative(session, tenant, post_id)
        count = await check_regen_limit(session, tenant.id, post_id)
        assert count == 1  # returned count lets caller stamp regen_index

    async def test_at_cap_rejects(self, session, tenant):
        post_id = uuid.uuid4()
        for _ in range(MAX_GENERATIONS_PER_POST):
            await _insert_creative(session, tenant, post_id)

        with pytest.raises(RegenLimitExceeded) as exc_info:
            await check_regen_limit(session, tenant.id, post_id)
        assert exc_info.value.existing_count == MAX_GENERATIONS_PER_POST
        assert exc_info.value.content_post_id == post_id

    async def test_different_post_not_counted(self, session, tenant):
        post_a = uuid.uuid4()
        post_b = uuid.uuid4()
        # Max out post_a.
        for _ in range(MAX_GENERATIONS_PER_POST):
            await _insert_creative(session, tenant, post_a)
        # Post_b should still be fresh.
        count = await check_regen_limit(session, tenant.id, post_b)
        assert count == 0

    async def test_none_post_id_never_counted(self, session, tenant):
        """Standalone creatives (no anchor post) are not subject to the cap."""
        # Insert a bunch of standalone creatives.
        for _ in range(5):
            await _insert_creative(session, tenant, None)
        # Calling with None still returns 0 — they're invisible to the guard.
        count = await check_regen_limit(session, tenant.id, None)
        assert count == 0

    async def test_count_is_per_tenant(self, session, tenant):
        """A different tenant's assets don't affect this tenant's count."""
        post_id = uuid.uuid4()
        await _insert_creative(session, tenant, post_id)

        # Query with a totally unrelated tenant_id — must see zero.
        unrelated_tid = uuid.uuid4()
        count = await count_existing_creatives_for_post(
            session, unrelated_tid, post_id
        )
        assert count == 0
