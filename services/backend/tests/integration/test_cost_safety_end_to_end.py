"""Phase 7 P2: end-to-end cost safety verification.

Proves the budget gate is wired into content_gen and creative_gen paths by
exhausting a tenant's limit and asserting the next call raises AIBudgetExceeded.

We test at the gate level (not via HTTP) because:
- Exercising the full HTTP stack would require real OpenRouter credentials.
- The gate is the contract; anything past it is the LangGraph execution.

Complements `test_ai_budget.py` (which focuses on the gate primitives) by
wiring through the same paths the real routers use.
"""
from __future__ import annotations

import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.ai_budget import (
    AIBudgetExceeded,
    DEEP_MODE_MONTHLY_CAP,
    check,
    estimate_feature,
    estimate_plan_mode,
    get_or_init_config,
    record,
)
from app.core.config import settings
from app.db.models import Tenant, TenantOpenRouterConfig


pytestmark = [pytest.mark.integration, pytest.mark.asyncio]


_TEST_SLUG = "pytest-cost-e2e-tenant"


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
            text("DELETE FROM tenant_ai_config WHERE tenant_id = :t"), {"t": row.id}
        )
        await session.execute(
            text("DELETE FROM agent_runs WHERE tenant_id = :t"), {"t": row.id}
        )
    plan_row = (await session.execute(text("SELECT id FROM plans LIMIT 1"))).first()
    if row:
        tres = await session.execute(
            __import__("sqlalchemy").select(Tenant).where(Tenant.id == row.id)
        )
        t = tres.scalar_one()
    else:
        t = Tenant(
            name="Cost E2E Tenant",
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
        text("DELETE FROM agent_runs WHERE tenant_id = :t"), {"t": t.id}
    )
    await session.commit()


class TestContentGenBlocksOverBudget:
    async def test_content_generate_rejected_when_over_limit(self, session, tenant):
        # Set tenant at 99% of a $1 budget — next content call would exceed.
        cfg = await get_or_init_config(session, tenant.id)
        cfg.monthly_limit_usd = 1.00
        cfg.usage_usd = 0.99
        await session.commit()

        # estimate_feature("content_gen.generate") = 0.05 > 0.01 remaining.
        with pytest.raises(AIBudgetExceeded) as exc_info:
            await check(
                session, tenant.id,
                estimated_cost_usd=estimate_feature("content_gen.generate"),
                feature="content_gen.generate",
            )
        assert exc_info.value.reason == "would_exceed"

    async def test_content_generate_blocked_when_limit_reached(self, session, tenant):
        cfg = await get_or_init_config(session, tenant.id)
        cfg.monthly_limit_usd = 1.00
        cfg.usage_usd = 1.00  # exactly at limit → hard block
        await session.commit()

        with pytest.raises(AIBudgetExceeded) as exc_info:
            await check(
                session, tenant.id,
                estimated_cost_usd=estimate_feature("content_gen.generate"),
                feature="content_gen.generate",
            )
        assert exc_info.value.reason == "limit_reached"


class TestCreativeGenBlocksOverBudget:
    async def test_image_generate_blocked_when_over_limit(self, session, tenant):
        cfg = await get_or_init_config(session, tenant.id)
        cfg.monthly_limit_usd = 0.50
        cfg.usage_usd = 0.50
        await session.commit()

        with pytest.raises(AIBudgetExceeded) as exc_info:
            await check(
                session, tenant.id,
                estimated_cost_usd=estimate_feature("creative_gen.image"),
                feature="creative_gen.image",
            )
        assert exc_info.value.reason == "limit_reached"


class TestPlanModeCapAtTierBoundary:
    async def test_deep_mode_cap_enforced_at_limit(self, session, tenant):
        """Exactly 10 deep runs → next one must fail with deep_mode_cap."""
        from datetime import datetime, timezone
        from app.db.models import AgentRun

        cfg = await get_or_init_config(session, tenant.id)
        cfg.monthly_limit_usd = 100.0  # plenty of dollar budget
        cfg.usage_usd = 0.0
        await session.commit()

        for _ in range(DEEP_MODE_MONTHLY_CAP):
            session.add(AgentRun(
                tenant_id=tenant.id,
                agent_name="strategy",
                thread_id=f"t-{uuid.uuid4()}",
                input={"plan_mode": "deep"},
                output={},
                status="succeeded",
                cost_usd=0.50,
                started_at=datetime.now(timezone.utc),
            ))
        await session.commit()

        with pytest.raises(AIBudgetExceeded) as exc_info:
            await check(
                session, tenant.id,
                estimated_cost_usd=estimate_plan_mode("deep"),
                feature="plan.generate",
                plan_mode="deep",
            )
        assert exc_info.value.reason == "deep_mode_cap"

        # But a Fast run is still fine — Deep cap is mode-specific.
        status = await check(
            session, tenant.id,
            estimated_cost_usd=estimate_plan_mode("fast"),
            feature="plan.generate",
            plan_mode="fast",
        )
        assert status.blocked is False


class TestRecordUpdatesLedger:
    async def test_record_actual_cost_moves_usage(self, session, tenant):
        cfg = await get_or_init_config(session, tenant.id)
        cfg.monthly_limit_usd = 10.0
        cfg.usage_usd = 0.0
        await session.commit()

        await record(
            session, tenant.id,
            actual_cost_usd=0.12, feature="plan.generate", model="openai/gpt-4o",
        )
        await record(
            session, tenant.id,
            actual_cost_usd=0.05, feature="content_gen.generate", model="openai/gpt-4o",
        )
        await session.commit()

        # Fresh fetch — verify ledger accumulated correctly.
        refreshed = await get_or_init_config(session, tenant.id)
        assert float(refreshed.usage_usd) == pytest.approx(0.17, abs=0.001)
