"""Marketing plan generation service."""
from __future__ import annotations

import time
import uuid
from datetime import date, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.plan_modes import load_mode_config
from app.agents.registry import get_agent
from app.agents.strategy.subagents.audience_profiler import AudienceProfiler
from app.agents.strategy.subagents.channel_planner import ChannelPlanner
from app.agents.strategy.subagents.content_calendar import ContentCalendar
from app.agents.strategy.subagents.kpi_setter import KPISetter
from app.agents.strategy.subagents.market_analyzer import MarketAnalyzer
from app.agents.tracing import AgentTracer
from app.db.models import AgentRun, BrandSettings, MarketingPlan, Plan, Tenant
from app.modules.plan_versioning.service import snapshot_plan


class PlanModeNotAllowed(Exception):
    """Raised when a tenant's current subscription tier doesn't include the
    requested plan_mode. Translated to HTTP 403 by the router so the frontend
    can show an upgrade CTA targeted at the mode (e.g. "Upgrade to Growth to
    unlock Deep mode")."""
    def __init__(self, *, plan_slug: str, requested_mode: str, allowed: list[str]) -> None:
        self.plan_slug = plan_slug
        self.requested_mode = requested_mode
        self.allowed = allowed
        super().__init__(
            f"Plan mode '{requested_mode}' not available on tier '{plan_slug}'. "
            f"Allowed: {allowed}"
        )


_SECTION_TO_SUBAGENT = {
    "goals": MarketAnalyzer,  # market_analysis drives goals
    "personas": AudienceProfiler,
    "channels": ChannelPlanner,
    "calendar": ContentCalendar,
    "kpis": KPISetter,
}

_SECTION_TO_KEYS = {
    "goals": ["goals", "market_analysis"],
    "personas": ["personas"],
    "channels": ["channels"],
    "calendar": ["calendar"],
    "kpis": ["kpis"],
}

# Strategic section keys persisted from final_state to MarketingPlan columns.
_STRATEGIC_KEYS = (
    "positioning",
    "customer_journey",
    "offer",
    "funnel",
    "conversion",
    "retention",
    "growth_loops",
    "execution_roadmap",
)


async def _build_business_profile(
    db: AsyncSession, tenant_id: uuid.UUID, override: dict[str, Any] | None
) -> dict[str, Any]:
    if override:
        return override

    tenant = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
    brand = (
        await db.execute(select(BrandSettings).where(BrandSettings.tenant_id == tenant_id))
    ).scalar_one_or_none()

    profile: dict[str, Any] = {
        "name": tenant.name if tenant else "",
        "config": tenant.config if tenant and tenant.config else {},
    }
    if brand:
        profile.update({
            "brand_name": brand.brand_name if hasattr(brand, "brand_name") else None,
            "tone": getattr(brand, "tone", None),
            "colors": brand.colors or {},
            "fonts": brand.fonts or {},
            "logo_url": brand.logo_url,
        })
    return profile


async def _persist_plan(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    title: str,
    period_days: int,
    final_state: dict[str, Any],
    run: AgentRun | None = None,
    model: str | None = None,
    started_perf: float | None = None,
    traces: list | None = None,
    budget_monthly_usd: float | None = None,
    primary_goal: str | None = None,
    plan_mode: str = "fast",
) -> MarketingPlan:
    """Persist a MarketingPlan and finalize the AgentRun. Shared by sync + stream endpoints."""
    # Run realism validation on the full generated state. Warnings are
    # attached to run.output so admins can see them in /admin/agent-runs
    # and reviewers can spot-check the plan before approving. We do NOT
    # block on warnings today — blocking would require human-in-the-loop
    # for every plan, which is too aggressive for a first rollout.
    from app.core.ai_guardrails import has_blocking_issues, validate_realism
    realism_warnings = validate_realism(final_state)
    if has_blocking_issues(realism_warnings):
        import logging
        logging.getLogger(__name__).warning(
            "plan generation produced forbidden-claim output (tenant=%s): %s",
            tenant_id,
            [w for w in realism_warnings if w["severity"] == "error"][:5],
        )

    if run is not None:
        run.status = "succeeded"
        output = {k: v for k, v in final_state.items() if k != "tenant_id"}
        if traces is not None:
            output["_traces"] = traces
        # Surface realism warnings in the audit trail — reviewers see them,
        # ops can aggregate them, automated alerting can trigger on `error` count.
        output["_realism_warnings"] = realism_warnings
        run.output = output
        if model:
            run.model = model
        if started_perf is not None:
            run.latency_ms = int((time.perf_counter() - started_perf) * 1000)

        # Phase 5 P1: credit the tenant's spend ledger with the actual cost.
        # cost_usd is computed by the LangGraph tracer from token counts.
        # Zero/None cost is common in dev (no real LLM key) — skip quietly.
        if run.cost_usd:
            try:
                from app.core.ai_budget import record as _budget_record
                await _budget_record(
                    db, tenant_id,
                    actual_cost_usd=float(run.cost_usd),
                    feature="plan.generate",
                    model=model,
                )
            except Exception as e:  # noqa: BLE001
                # Spend recording must never block plan persistence. Log and move on.
                import logging
                logging.getLogger(__name__).warning(
                    "budget.record failed for tenant %s: %s", tenant_id, e,
                )

    today = date.today()
    kwargs: dict[str, Any] = dict(
        tenant_id=tenant_id,
        created_by=user_id,
        title=title,
        period_start=today,
        period_end=today + timedelta(days=period_days),
        goals=final_state.get("goals", []),
        personas=final_state.get("personas", []),
        channels=final_state.get("channels", []),
        calendar=final_state.get("calendar", []),
        kpis=final_state.get("kpis", []),
        market_analysis=final_state.get("market_analysis", {}),
        ad_strategy=final_state.get("ad_strategy", {}),
        budget_monthly_usd=budget_monthly_usd,
        primary_goal=primary_goal,
        plan_mode=plan_mode,
        status="draft",
        version=1,
    )
    for key in _STRATEGIC_KEYS:
        kwargs[key] = final_state.get(key, [] if key == "execution_roadmap" else {})

    plan = MarketingPlan(**kwargs)
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return plan


async def generate_plan(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    *,
    title: str,
    period_days: int,
    language: str,
    business_profile: dict[str, Any] | None,
    model_override: str | None,
    budget_monthly_usd: float | None = None,
    budget_currency: str = "usd",
    primary_goal: str | None = None,
    urgency_days: int = 30,
    plan_mode: str = "fast",
) -> MarketingPlan:
    # Phase 6 P4: plan-mode access by tier. Free/Starter tenants who hit the
    # /generate endpoint with plan_mode=deep should get a clear "upgrade" error,
    # not a confusing "budget exceeded" or a successful expensive run.
    # We look up the tenant's plan slug and allowed modes from the billing catalog.
    from app.modules.billing.service import DEFAULT_PLANS
    tenant_row = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    _tenant = tenant_row.scalar_one_or_none()
    if _tenant is not None and _tenant.plan_id is not None:
        plan_row = await db.execute(select(Plan).where(Plan.id == _tenant.plan_id))
        _plan_db = plan_row.scalar_one_or_none()
        if _plan_db is not None:
            _slug = _plan_db.slug
            _catalog = next((p for p in DEFAULT_PLANS if p["slug"] == _slug), None)
            allowed = (_catalog or {}).get(
                "plan_modes_allowed", ["fast", "medium", "deep"]
            )
            if plan_mode.lower() not in [m.lower() for m in allowed]:
                raise PlanModeNotAllowed(
                    plan_slug=_slug, requested_mode=plan_mode, allowed=allowed
                )

    # Phase 5 P1: AI cost gate. Reject unaffordable plan requests BEFORE we
    # spin up a 3-minute agent run. Surfaces as HTTP 402 with a machine-readable
    # reason code so the frontend can route the user to the upgrade CTA.
    from app.core.ai_budget import check as _budget_check, estimate_plan_mode
    estimated = estimate_plan_mode(plan_mode)
    await _budget_check(
        db, tenant_id,
        estimated_cost_usd=estimated,
        feature="plan.generate",
        plan_mode=plan_mode,
    )

    profile = await _build_business_profile(db, tenant_id, business_profile)
    mode_config = await load_mode_config(db, plan_mode)

    run = AgentRun(
        tenant_id=tenant_id,
        agent_name="strategy",
        input={
            "title": title,
            "period_days": period_days,
            "language": language,
            "plan_mode": plan_mode,
            "budget_monthly_usd": budget_monthly_usd,
            "budget_currency": budget_currency,
            "primary_goal": primary_goal,
            "urgency_days": urgency_days,
        },
        status="running",
    )
    db.add(run)
    await db.flush()

    started = time.perf_counter()
    tracer = AgentTracer(tenant_id=tenant_id, run_id=run.id)
    try:
        agent = get_agent("strategy", str(tenant_id), model_override=model_override, mode_config=mode_config)
        result = await agent.run(
            {
                "tenant_id": str(tenant_id),
                "business_profile": profile,
                "language": language,
                "period_days": period_days,
                "budget_monthly_usd": budget_monthly_usd if budget_monthly_usd is not None else 500.0,
                "budget_currency": budget_currency,
                "primary_goal": primary_goal or "",
                "urgency_days": urgency_days,
            },
            thread_id=f"plan:{run.id}",
            tracer=tracer,
        )

    except Exception as e:
        run.status = "failed"
        run.error = str(e)[:2000]
        run.output = {"_traces": tracer.traces}
        run.latency_ms = int((time.perf_counter() - started) * 1000)
        await db.commit()
        raise

    return await _persist_plan(
        db,
        tenant_id=tenant_id,
        user_id=user_id,
        title=title,
        period_days=period_days,
        final_state=result,
        run=run,
        model=agent.model,
        started_perf=started,
        traces=tracer.traces,
        budget_monthly_usd=budget_monthly_usd,
        primary_goal=primary_goal,
        plan_mode=plan_mode,
    )


async def regenerate_plan_section(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    plan: MarketingPlan,
    section: str,
    language: str = "ar",
    note: str = "",
) -> MarketingPlan:
    """Re-run a single strategy sub-agent and patch only that section of the plan."""
    if section not in _SECTION_TO_SUBAGENT:
        raise ValueError(f"Unknown section: {section}")

    # Snapshot BEFORE mutating so rollback is possible.
    await snapshot_plan(db, plan, reason=f"section regenerate: {section}", user_id=user_id)

    profile = await _build_business_profile(db, tenant_id, None)
    # Inject user feedback into the profile so sub-agents see it as extra context.
    if note:
        profile = {**profile, "user_feedback": note.strip()}

    run = AgentRun(
        tenant_id=tenant_id,
        agent_name=f"strategy.{section}",
        input={"section": section, "language": language, "plan_id": str(plan.id)},
        status="running",
    )
    db.add(run)
    await db.flush()

    started = time.perf_counter()
    tracer = AgentTracer(tenant_id=tenant_id, run_id=run.id)

    state = {
        "tenant_id": str(tenant_id),
        "business_profile": profile,
        "language": language,
        "period_days": (plan.period_end - plan.period_start).days if plan.period_start and plan.period_end else 30,
        "market_analysis": plan.market_analysis or {},
        "personas": plan.personas or [],
        "channels": plan.channels or [],
        "calendar": plan.calendar or [],
        "kpis": plan.kpis or [],
        "goals": plan.goals or [],
        "budget_monthly_usd": float(plan.budget_monthly_usd) if plan.budget_monthly_usd is not None else 500.0,
        "primary_goal": plan.primary_goal or "",
        "urgency_days": 30,
        "offer": getattr(plan, "offer", {}) or {},
        "funnel": getattr(plan, "funnel", {}) or {},
        "customer_journey": getattr(plan, "customer_journey", {}) or {},
    }

    try:
        sub_cls = _SECTION_TO_SUBAGENT[section]
        sub = sub_cls(str(tenant_id))
        patch = await sub.execute(state)
    except Exception as e:
        run.status = "failed"
        run.error = str(e)[:2000]
        run.output = {"_traces": tracer.traces}
        run.latency_ms = int((time.perf_counter() - started) * 1000)
        await db.commit()
        raise

    run.status = "succeeded"
    run.output = patch
    run.latency_ms = int((time.perf_counter() - started) * 1000)

    for k in _SECTION_TO_KEYS[section]:
        if k in patch:
            setattr(plan, k, patch[k])

    plan.version = (plan.version or 1) + 1
    await db.commit()
    await db.refresh(plan)
    return plan


async def regenerate_full_plan(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    plan: MarketingPlan,
    language: str = "ar",
    note: str = "",
) -> MarketingPlan:
    """Re-run the full strategy pipeline, injecting the user's feedback note and
    the previous plan as extra context. Overwrites all plan fields on the existing row."""
    # Snapshot the current plan before we regenerate so the user can roll back.
    await snapshot_plan(db, plan, reason="full regenerate", user_id=user_id)

    profile = await _build_business_profile(db, tenant_id, None)
    if note:
        profile = {**profile, "user_feedback": note.strip()}
    profile = {
        **profile,
        "previous_plan_summary": {
            "goals": plan.goals,
            "market_analysis": plan.market_analysis,
            "personas": plan.personas,
            "positioning": getattr(plan, "positioning", None),
            "channels": plan.channels,
            "offer": getattr(plan, "offer", None),
            "kpis": plan.kpis,
        },
    }

    mode_config = await load_mode_config(db, plan.plan_mode or "fast")

    run = AgentRun(
        tenant_id=tenant_id,
        agent_name="strategy.regenerate",
        input={"plan_id": str(plan.id), "note": note, "language": language},
        status="running",
    )
    db.add(run)
    await db.flush()

    started = time.perf_counter()
    tracer = AgentTracer(tenant_id=tenant_id, run_id=run.id)

    period_days = (
        (plan.period_end - plan.period_start).days
        if plan.period_start and plan.period_end
        else 30
    )

    try:
        agent = get_agent("strategy", str(tenant_id), model_override=None, mode_config=mode_config)
        result = await agent.run(
            {
                "tenant_id": str(tenant_id),
                "business_profile": profile,
                "language": language,
                "period_days": period_days,
                "budget_monthly_usd": float(plan.budget_monthly_usd) if plan.budget_monthly_usd is not None else 500.0,
                "budget_currency": getattr(plan, "budget_currency", "usd") or "usd",
                "primary_goal": plan.primary_goal or "",
                "urgency_days": 30,
            },
            thread_id=f"plan:{run.id}",
            tracer=tracer,
        )
    except Exception as e:
        run.status = "failed"
        run.error = str(e)[:2000]
        run.output = {"_traces": tracer.traces}
        run.latency_ms = int((time.perf_counter() - started) * 1000)
        await db.commit()
        raise

    run.status = "succeeded"
    run.latency_ms = int((time.perf_counter() - started) * 1000)
    run.output = {"_traces": tracer.traces}

    # Patch every known section key from the result onto the plan row.
    # swot / trends / competitors are NOT columns — merge them into market_analysis.
    _REAL_COLUMNS = (
        "goals", "personas", "channels", "calendar", "kpis",
        "market_analysis", "positioning", "customer_journey", "offer",
        "funnel", "conversion", "retention", "growth_loops", "execution_roadmap",
    )
    for key in _REAL_COLUMNS:
        if key in result:
            setattr(plan, key, result[key])
    # Merge embedded-in-market_analysis fields
    embedded = {k: result[k] for k in ("swot", "trends", "competitors") if k in result}
    if embedded:
        ma = dict(plan.market_analysis or {})
        ma.update(embedded)
        plan.market_analysis = ma

    plan.version = (plan.version or 1) + 1
    # Regenerated plans go back to draft so the user re-reviews
    plan.status = "draft"
    await db.commit()
    await db.refresh(plan)
    return plan
