"""Marketing plan generation service."""
from __future__ import annotations

import time
import uuid
from datetime import date, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.registry import get_agent
from app.agents.strategy.subagents.audience_profiler import AudienceProfiler
from app.agents.strategy.subagents.channel_planner import ChannelPlanner
from app.agents.strategy.subagents.content_calendar import ContentCalendar
from app.agents.strategy.subagents.kpi_setter import KPISetter
from app.agents.strategy.subagents.market_analyzer import MarketAnalyzer
from app.agents.tracing import AgentTracer
from app.db.models import AgentRun, BrandSettings, MarketingPlan, Tenant


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
    plan = MarketingPlan(
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
        status="draft",
        version=1,
    )
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
) -> MarketingPlan:
    profile = await _build_business_profile(db, tenant_id, business_profile)

    run = AgentRun(
        tenant_id=tenant_id,
        agent_name="strategy",
        input={"title": title, "period_days": period_days, "language": language},
        status="running",
    )
    db.add(run)
    await db.flush()

    started = time.perf_counter()
    tracer = AgentTracer(tenant_id=tenant_id, run_id=run.id)
    try:
        agent = get_agent("strategy", str(tenant_id), model_override=model_override)
        result = await agent.run(
            {
                "tenant_id": str(tenant_id),
                "business_profile": profile,
                "language": language,
                "period_days": period_days,
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
    )


async def regenerate_plan_section(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    plan: MarketingPlan,
    section: str,
    language: str = "ar",
) -> MarketingPlan:
    """Re-run a single strategy sub-agent and patch only that section of the plan."""
    if section not in _SECTION_TO_SUBAGENT:
        raise ValueError(f"Unknown section: {section}")

    profile = await _build_business_profile(db, tenant_id, None)

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

