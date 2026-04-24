"""Phase 5 P1: AI cost control — budget gate, spend recording, deep-mode cap."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

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
    get_status,
    record,
    tenant_spend_breakdown,
)
from app.core.config import settings
from app.db.models import AgentRun, Tenant, TenantOpenRouterConfig


pytestmark = [pytest.mark.integration, pytest.mark.asyncio]


_TEST_SLUG = "pytest-ai-budget-tenant"


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
async def tenant(session) -> Tenant:
    row = (await session.execute(
        text("SELECT id FROM tenants WHERE slug = :s"), {"s": _TEST_SLUG}
    )).first()
    if row:
        tres = await session.execute(
            __import__("sqlalchemy").select(Tenant).where(Tenant.id == row.id)
        )
        return tres.scalar_one()
    plan_row = (await session.execute(text("SELECT id FROM plans LIMIT 1"))).first()
    t = Tenant(name="AI Budget Tenant", slug=_TEST_SLUG, plan_id=plan_row.id, is_active=True)
    session.add(t)
    await session.commit()
    return t


@pytest.fixture(autouse=True)
async def reset_budget(session, tenant):
    """Each test starts with limit=$2.50, usage=$0, no AgentRuns."""
    await session.execute(
        text("DELETE FROM agent_runs WHERE tenant_id = :t"), {"t": tenant.id}
    )
    await session.execute(
        text("DELETE FROM tenant_ai_config WHERE tenant_id = :t"), {"t": tenant.id}
    )
    await session.commit()
    yield
    await session.execute(
        text("DELETE FROM agent_runs WHERE tenant_id = :t"), {"t": tenant.id}
    )
    await session.commit()


class TestEstimators:
    def test_plan_mode_estimates_ordered_correctly(self):
        # Fast < Medium < Deep.
        assert estimate_plan_mode("fast") < estimate_plan_mode("medium")
        assert estimate_plan_mode("medium") < estimate_plan_mode("deep")

    def test_unknown_mode_defaults_to_fast(self):
        assert estimate_plan_mode("nonsense") == estimate_plan_mode("fast")

    def test_feature_estimate_has_default(self):
        # Unknown feature returns a sensible non-zero default.
        assert estimate_feature("fully-made-up") > 0


class TestBudgetGate:
    async def test_fresh_tenant_passes_cheap_request(self, session, tenant):
        # Default config: $2.50 limit, $0 used. A $0.05 request passes.
        status = await check(
            session, tenant.id, estimated_cost_usd=0.05, feature="content_gen.generate"
        )
        assert status.blocked is False
        assert status.remaining_usd > 0

    async def test_blocks_when_limit_reached(self, session, tenant):
        cfg = await get_or_init_config(session, tenant.id)
        cfg.monthly_limit_usd = 1.00
        cfg.usage_usd = 1.00
        await session.commit()

        with pytest.raises(AIBudgetExceeded) as exc_info:
            await check(
                session, tenant.id, estimated_cost_usd=0.05, feature="plan.generate"
            )
        assert exc_info.value.reason == "limit_reached"

    async def test_blocks_when_request_would_exceed_limit(self, session, tenant):
        cfg = await get_or_init_config(session, tenant.id)
        cfg.monthly_limit_usd = 1.00
        cfg.usage_usd = 0.80
        await session.commit()

        # $0.80 used + $0.50 estimate = $1.30 > $1.00 limit → block.
        with pytest.raises(AIBudgetExceeded) as exc_info:
            await check(
                session, tenant.id, estimated_cost_usd=0.50, feature="plan.generate"
            )
        assert exc_info.value.reason == "would_exceed"
        # But a smaller request still passes.
        status = await check(
            session, tenant.id, estimated_cost_usd=0.10, feature="plan.generate"
        )
        assert status.blocked is False

    async def test_soft_warning_threshold(self, session, tenant):
        cfg = await get_or_init_config(session, tenant.id)
        cfg.monthly_limit_usd = 1.00
        cfg.usage_usd = 0.85  # 85% of limit
        await session.commit()

        status = await get_status(session, tenant.id)
        assert status.soft_warning is True
        assert status.blocked is False


class TestDeepModeCap:
    async def _seed_deep_run(self, session, tenant_id: uuid.UUID, n: int = 1) -> None:
        """Insert N AgentRuns for strategy agent in 'deep' mode this month."""
        for _ in range(n):
            run = AgentRun(
                tenant_id=tenant_id,
                agent_name="strategy",
                thread_id=f"test-{uuid.uuid4()}",
                input={"plan_mode": "deep"},
                output={},
                status="succeeded",
                cost_usd=0.50,
                started_at=datetime.now(timezone.utc),
            )
            session.add(run)
        await session.commit()

    async def test_deep_mode_cap_enforced(self, session, tenant):
        await self._seed_deep_run(session, tenant.id, n=DEEP_MODE_MONTHLY_CAP)
        # Fresh request in deep mode — budget fine, but deep count at cap.
        with pytest.raises(AIBudgetExceeded) as exc_info:
            await check(
                session, tenant.id, estimated_cost_usd=0.50,
                feature="plan.generate", plan_mode="deep"
            )
        assert exc_info.value.reason == "deep_mode_cap"

    async def test_fast_mode_not_capped_by_deep_count(self, session, tenant):
        await self._seed_deep_run(session, tenant.id, n=DEEP_MODE_MONTHLY_CAP)
        # Fast mode should still pass — cap is deep-specific.
        status = await check(
            session, tenant.id, estimated_cost_usd=0.05,
            feature="plan.generate", plan_mode="fast"
        )
        assert status.blocked is False

    async def test_deep_allowed_below_cap(self, session, tenant):
        await self._seed_deep_run(session, tenant.id, n=DEEP_MODE_MONTHLY_CAP - 1)
        status = await check(
            session, tenant.id, estimated_cost_usd=0.50,
            feature="plan.generate", plan_mode="deep"
        )
        assert status.blocked is False

    async def test_old_deep_runs_dont_count(self, session, tenant):
        """Runs from previous months don't count against this month's cap."""
        old_run = AgentRun(
            tenant_id=tenant.id,
            agent_name="strategy",
            thread_id="old",
            input={"plan_mode": "deep"},
            output={},
            status="succeeded",
            cost_usd=0.50,
            # Explicitly stamp started_at to 2 months ago so it's definitely
            # outside the current-month window no matter when this runs.
            started_at=datetime.now(timezone.utc) - timedelta(days=65),
        )
        session.add(old_run)
        await session.commit()

        status = await check(
            session, tenant.id, estimated_cost_usd=0.50,
            feature="plan.generate", plan_mode="deep"
        )
        assert status.blocked is False


class TestRecord:
    async def test_record_adds_to_usage(self, session, tenant):
        cfg = await get_or_init_config(session, tenant.id)
        cfg.monthly_limit_usd = 5.00
        cfg.usage_usd = 0.0
        await session.commit()

        await record(session, tenant.id, actual_cost_usd=0.12, feature="plan.generate", model="openai/gpt-4o")
        await session.commit()

        status = await get_status(session, tenant.id)
        assert status.usage_usd == pytest.approx(0.12, abs=0.0001)

    async def test_record_accumulates(self, session, tenant):
        cfg = await get_or_init_config(session, tenant.id)
        cfg.usage_usd = 0.0
        await session.commit()

        for _ in range(3):
            await record(session, tenant.id, actual_cost_usd=0.05, feature="x", model="m")
        await session.commit()

        status = await get_status(session, tenant.id)
        assert status.usage_usd == pytest.approx(0.15, abs=0.001)

    async def test_record_ignores_negative(self, session, tenant):
        cfg = await get_or_init_config(session, tenant.id)
        cfg.usage_usd = 0.10
        await session.commit()

        await record(session, tenant.id, actual_cost_usd=-5.00, feature="x", model="m")
        await session.commit()

        status = await get_status(session, tenant.id)
        # Negative values clamped to 0 — usage shouldn't decrease.
        assert status.usage_usd == pytest.approx(0.10, abs=0.001)


class TestSpendBreakdown:
    async def test_breakdown_groups_by_feature_and_model(self, session, tenant):
        # Seed 3 runs across 2 features and 2 models.
        runs = [
            AgentRun(tenant_id=tenant.id, agent_name="strategy",
                     thread_id="a", input={}, output={}, status="succeeded",
                     cost_usd=0.50, model="openai/gpt-4o"),
            AgentRun(tenant_id=tenant.id, agent_name="strategy",
                     thread_id="b", input={}, output={}, status="succeeded",
                     cost_usd=0.30, model="anthropic/claude-sonnet-4-5"),
            AgentRun(tenant_id=tenant.id, agent_name="content",
                     thread_id="c", input={}, output={}, status="succeeded",
                     cost_usd=0.02, model="openai/gpt-4o"),
        ]
        for r in runs:
            session.add(r)
        await session.commit()

        out = await tenant_spend_breakdown(session, tenant.id, days=30)

        features = {row["feature"]: row for row in out["by_feature"]}
        assert features["strategy"]["runs"] == 2
        assert features["strategy"]["cost_usd"] == pytest.approx(0.80, abs=0.001)
        assert features["content"]["runs"] == 1

        models = {row["model"]: row for row in out["by_model"]}
        assert models["openai/gpt-4o"]["runs"] == 2
        assert models["openai/gpt-4o"]["cost_usd"] == pytest.approx(0.52, abs=0.001)
        assert models["anthropic/claude-sonnet-4-5"]["runs"] == 1
