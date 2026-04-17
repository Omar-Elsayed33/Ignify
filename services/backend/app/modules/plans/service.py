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
from app.db.models import AgentRun, BrandSettings, MarketingPlan, Tenant
from app.modules.plan_versioning.service import snapshot_plan


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
    if run is not None:
        run.status = "succeeded"
        output = {k: v for k, v in final_state.items() if k != "tenant_id"}
        if traces is not None:
            output["_traces"] = traces
        run.output = output
        if model:
            run.model = model
        if started_perf is not None:
            run.latency_ms = int((time.perf_counter() - started_perf) * 1000)

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
