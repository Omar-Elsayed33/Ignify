"""Phase 7 P1.1: budget sync on plan assignment / subscription change.

Verifies the critical blocker: a tenant's `monthly_limit_usd` must match
their plan's `ai_budget_usd` after any path that changes their plan.

Covers:
- `limit_for_plan(slug)` reads from DEFAULT_PLANS catalog (single source of
  truth, not hardcoded dict).
- `update_tenant_plan_limit` creates the config row if missing.
- `sync_tenant_budget_to_plan` resolves a tenant's plan and applies the limit.
- Each catalog slug maps to the correct dollar cap.
"""
from __future__ import annotations

import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.openrouter_provisioning import limit_for_plan
from app.db.models import Plan, Tenant, TenantOpenRouterConfig
from app.modules.billing.service import DEFAULT_PLANS


pytestmark = [pytest.mark.integration, pytest.mark.asyncio]


_TEST_SLUG = "pytest-budget-sync-tenant"


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
async def tenant_fixture(session):
    """Fresh tenant with NO pre-existing TenantOpenRouterConfig row."""
    row = (await session.execute(
        text("SELECT id FROM tenants WHERE slug = :s"), {"s": _TEST_SLUG}
    )).first()
    if row:
        await session.execute(
            text("DELETE FROM tenant_ai_config WHERE tenant_id = :t"), {"t": row.id}
        )
        await session.execute(
            text("DELETE FROM tenants WHERE id = :t"), {"t": row.id}
        )
        await session.commit()
    plan_row = (await session.execute(text("SELECT id FROM plans LIMIT 1"))).first()
    t = Tenant(
        name="Pytest Budget Sync",
        slug=_TEST_SLUG,
        plan_id=plan_row.id,
        is_active=True,
    )
    session.add(t)
    await session.commit()
    yield t
    await session.execute(
        text("DELETE FROM tenant_ai_config WHERE tenant_id = :t"), {"t": t.id}
    )
    await session.execute(
        text("DELETE FROM tenants WHERE id = :t"), {"t": t.id}
    )
    await session.commit()


class TestLimitForPlan:
    """Unit-level checks on the catalog lookup — runs without DB."""

    @pytest.mark.parametrize("slug,expected", [
        ("free", 0.50),
        ("starter", 6.00),
        ("growth", 12.00),
        ("pro", 22.00),
        ("agency", 70.00),
    ])
    def test_catalog_slug_returns_correct_budget(self, slug, expected):
        assert limit_for_plan(slug) == expected

    def test_unknown_slug_returns_default(self):
        # $0.50 default matches Free tier — fail-safe choice.
        assert limit_for_plan("made-up-tier") == 0.50

    def test_none_returns_default(self):
        assert limit_for_plan(None) == 0.50

    def test_every_catalog_plan_has_ai_budget(self):
        """Regression guard: if someone adds a tier and forgets ai_budget_usd,
        this test fails and we don't silently ship a tier with the $0.50 cap."""
        for plan in DEFAULT_PLANS:
            limits = plan.get("limits", {}) or {}
            assert "ai_budget_usd" in limits, (
                f"plan {plan['slug']} missing limits.ai_budget_usd"
            )
            assert isinstance(limits["ai_budget_usd"], (int, float))
            assert limits["ai_budget_usd"] > 0 or plan["slug"] == "free", (
                f"plan {plan['slug']} has non-positive ai_budget_usd"
            )


class TestUpdateTenantPlanLimit:
    async def test_creates_config_when_missing(self, session, tenant_fixture):
        """Previously this method returned silently if no config existed.
        Now it must create the row — otherwise a newly-approved tenant sits
        without a budget ceiling."""
        from app.modules.ai_usage.service import update_tenant_plan_limit

        # Confirm no config exists.
        before = (await session.execute(
            text("SELECT COUNT(*) FROM tenant_ai_config WHERE tenant_id = :t"),
            {"t": tenant_fixture.id},
        )).scalar()
        assert before == 0

        await update_tenant_plan_limit(session, tenant_fixture.id, "growth")
        await session.commit()

        # Now exists with the Growth budget.
        cfg = (await session.execute(
            text("SELECT monthly_limit_usd FROM tenant_ai_config WHERE tenant_id = :t"),
            {"t": tenant_fixture.id},
        )).first()
        assert cfg is not None
        assert float(cfg.monthly_limit_usd) == 12.00

    async def test_updates_existing_config(self, session, tenant_fixture):
        from app.modules.ai_usage.service import update_tenant_plan_limit

        # Seed with Free budget.
        existing = TenantOpenRouterConfig(
            tenant_id=tenant_fixture.id, monthly_limit_usd=0.50
        )
        session.add(existing)
        await session.commit()

        # Upgrade to Pro.
        await update_tenant_plan_limit(session, tenant_fixture.id, "pro")
        await session.commit()

        await session.refresh(existing)
        assert float(existing.monthly_limit_usd) == 22.00

    async def test_downgrade_applies(self, session, tenant_fixture):
        from app.modules.ai_usage.service import update_tenant_plan_limit

        existing = TenantOpenRouterConfig(
            tenant_id=tenant_fixture.id, monthly_limit_usd=70.00
        )
        session.add(existing)
        await session.commit()

        # Downgrade Agency → Starter.
        await update_tenant_plan_limit(session, tenant_fixture.id, "starter")
        await session.commit()

        await session.refresh(existing)
        assert float(existing.monthly_limit_usd) == 6.00


class TestSyncTenantBudgetToPlan:
    """The high-level helper called from admin paths."""

    async def test_syncs_from_tenant_plan(self, session, tenant_fixture):
        from app.modules.ai_usage.service import sync_tenant_budget_to_plan

        # tenant_fixture already has plan_id set to the first seeded plan.
        # Find that plan's slug and check that sync applies it.
        plan = (await session.execute(
            __import__("sqlalchemy").select(Plan).where(Plan.id == tenant_fixture.plan_id)
        )).scalar_one()

        await sync_tenant_budget_to_plan(session, tenant_fixture)
        await session.commit()

        cfg = (await session.execute(
            __import__("sqlalchemy").select(TenantOpenRouterConfig).where(
                TenantOpenRouterConfig.tenant_id == tenant_fixture.id
            )
        )).scalar_one_or_none()
        assert cfg is not None
        # The applied limit must match the catalog value for the tenant's plan slug.
        assert float(cfg.monthly_limit_usd) == limit_for_plan(plan.slug)

    async def test_noop_when_tenant_has_no_plan(self, session, tenant_fixture):
        from app.modules.ai_usage.service import sync_tenant_budget_to_plan

        tenant_fixture.plan_id = None
        await session.commit()

        # Should not raise, should not create a config.
        await sync_tenant_budget_to_plan(session, tenant_fixture)
        await session.commit()

        cfg = (await session.execute(
            text("SELECT COUNT(*) FROM tenant_ai_config WHERE tenant_id = :t"),
            {"t": tenant_fixture.id},
        )).scalar()
        assert cfg == 0
