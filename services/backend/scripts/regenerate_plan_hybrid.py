"""Hybrid plan generation: use MODEL A for analysis sub-agents (market, audience,
positioning, customer_journey, funnel) and MODEL B for execution sub-agents
(offer, channels, conversion, retention, growth_loops, calendar, kpis, ad_strategy,
execution_roadmap).

Usage:
    python scripts/regenerate_plan_hybrid.py <plan_id> <analysis_model> <execution_model>
    python scripts/regenerate_plan_hybrid.py --latest <analysis_model> <execution_model>

Example:
    python scripts/regenerate_plan_hybrid.py --latest \\
        anthropic/claude-opus-4.6 openai/gpt-4o
"""
import asyncio
import os
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
os.environ["DEBUG"] = "true"

from sqlalchemy import select, desc  # noqa: E402
from app.db.database import async_session  # noqa: E402
from app.db.models import MarketingPlan  # noqa: E402
from app.agents.tracing import AgentTracer  # noqa: E402
from app.modules.plans.service import _build_business_profile  # noqa: E402

# Import sub-agents individually so we can override their model per phase.
from app.agents.strategy.subagents.market_analyzer import MarketAnalyzer
from app.agents.strategy.subagents.audience_profiler import AudienceProfiler
from app.agents.strategy.subagents.positioning_strategist import PositioningStrategist
from app.agents.strategy.subagents.customer_journey import CustomerJourney as CustomerJourneyAgent
from app.agents.strategy.subagents.funnel_architect import FunnelArchitect
from app.agents.strategy.subagents.offer_designer import OfferDesigner
from app.agents.strategy.subagents.channel_planner import ChannelPlanner
from app.agents.strategy.subagents.conversion_system import ConversionSystem
from app.agents.strategy.subagents.retention_strategy import RetentionStrategy
from app.agents.strategy.subagents.growth_loops import GrowthLoops
from app.agents.strategy.subagents.content_calendar import ContentCalendar
from app.agents.strategy.subagents.kpi_setter import KPISetter
from app.agents.strategy.subagents.ad_strategist import AdStrategist
from app.agents.strategy.subagents.execution_roadmap import ExecutionRoadmap

REPORTS_DIR = Path("/app/reports/model_compare")
REPORTS_DIR.mkdir(parents=True, exist_ok=True)


ANALYSIS_AGENTS = [
    ("market_analysis", MarketAnalyzer),
    ("personas", AudienceProfiler),
    ("positioning", PositioningStrategist),
    ("customer_journey", CustomerJourneyAgent),
    ("funnel", FunnelArchitect),
]

EXECUTION_AGENTS = [
    ("offer", OfferDesigner),
    ("channels", ChannelPlanner),
    ("conversion", ConversionSystem),
    ("retention", RetentionStrategy),
    ("growth_loops", GrowthLoops),
    ("calendar", ContentCalendar),
    ("kpis", KPISetter),
    ("ad_strategy", AdStrategist),
    ("execution_roadmap", ExecutionRoadmap),
]


def _safe(s: str) -> str:
    return "".join(c if c.isalnum() or c in "-_." else "_" for c in s)[:60]


async def run_hybrid(plan_id: str, analysis_model: str, execution_model: str) -> dict:
    async with async_session() as db:
        if plan_id == "--latest":
            q = select(MarketingPlan).order_by(desc(MarketingPlan.created_at)).limit(1)
            original = (await db.execute(q)).scalar_one()
        else:
            res = await db.execute(select(MarketingPlan).where(MarketingPlan.id == uuid.UUID(plan_id)))
            original = res.scalar_one_or_none()
            if not original:
                raise RuntimeError(f"Plan {plan_id} not found")

        tenant_id = original.tenant_id
        profile = await _build_business_profile(db, tenant_id, None)
        period_days = 30
        if original.period_start and original.period_end:
            period_days = (original.period_end - original.period_start).days or 30

        state = {
            "tenant_id": str(tenant_id),
            "business_profile": profile,
            "language": "ar",
            "period_days": period_days,
            "budget_monthly_usd": 500,
            "budget_currency": "USD",
            "primary_goal": original.title,
            "urgency_days": 30,
        }

        print(f"\n{'='*70}")
        print(f"🧠 HYBRID GENERATION")
        print(f"  Analysis model:  {analysis_model}")
        print(f"  Execution model: {execution_model}")
        print(f"{'='*70}\n")

        started = time.perf_counter()
        tokens_analysis = 0
        tokens_execution = 0

        # === Phase 1: Analysis (deep thinking) ===
        print(f"📊 Phase 1 — Analysis with {analysis_model}")
        for field, agent_cls in ANALYSIS_AGENTS:
            t0 = time.perf_counter()
            try:
                agent = agent_cls(str(tenant_id), model_override=analysis_model)
                result = await agent.execute(state)
                state.update({k: v for k, v in result.items() if k != "tenant_id"})
                print(f"   ✓ {field:22s}  ({time.perf_counter() - t0:.1f}s)")
            except Exception as e:
                print(f"   ✗ {field:22s}  FAILED: {str(e)[:100]}")

        # === Phase 2: Execution (structured output) ===
        print(f"\n🎯 Phase 2 — Execution with {execution_model}")
        for field, agent_cls in EXECUTION_AGENTS:
            t0 = time.perf_counter()
            try:
                agent = agent_cls(str(tenant_id), model_override=execution_model)
                result = await agent.execute(state)
                state.update({k: v for k, v in result.items() if k != "tenant_id"})
                print(f"   ✓ {field:22s}  ({time.perf_counter() - t0:.1f}s)")
            except Exception as e:
                print(f"   ✗ {field:22s}  FAILED: {str(e)[:100]}")

        duration = time.perf_counter() - started

        # Persist as new plan
        new_plan = MarketingPlan(
            tenant_id=tenant_id,
            created_by=original.created_by,
            title=f"{original.title} [hybrid: {analysis_model.split('/')[-1]}+{execution_model.split('/')[-1]}]",
            period_start=original.period_start,
            period_end=original.period_end,
            goals=state.get("goals", []),
            personas=state.get("personas", []),
            channels=state.get("channels", []),
            calendar=state.get("calendar", {}),
            kpis=state.get("kpis", []),
            market_analysis=state.get("market_analysis", {}),
            ad_strategy=state.get("ad_strategy", {}),
            status="draft",
            version=(original.version or 1) + 1,
        )
        for field in ("positioning", "customer_journey", "offer", "funnel", "conversion", "retention", "growth_loops", "execution_roadmap"):
            if hasattr(new_plan, field):
                setattr(new_plan, field, state.get(field, {}) or {})

        db.add(new_plan)
        await db.commit()
        await db.refresh(new_plan)

        # Write markdown report
        safe_name = f"hybrid_{_safe(analysis_model.replace('/','_'))}_+_{_safe(execution_model.replace('/','_'))}"
        md_path = REPORTS_DIR / f"{safe_name}.md"
        lines = [
            f"# Hybrid Plan — {analysis_model} + {execution_model}",
            "",
            f"- **Plan ID:** `{new_plan.id}`",
            f"- **Source plan:** `{original.id}`",
            f"- **Analysis model (thinking):** `{analysis_model}`",
            f"- **Execution model (output):** `{execution_model}`",
            f"- **Duration:** {duration:.1f}s",
            f"- **Generated at:** {datetime.utcnow().isoformat()}Z",
            "",
            "## Sections",
            "",
        ]
        for field in ["market_analysis", "personas", "positioning", "customer_journey", "offer",
                      "funnel", "channels", "conversion", "retention", "growth_loops",
                      "calendar", "kpis", "ad_strategy", "execution_roadmap"]:
            data = state.get(field)
            count = len(data) if isinstance(data, (list, dict)) else (1 if data else 0)
            marker = "✅" if data else "❌"
            lines.append(f"- {marker} **{field.replace('_', ' ')}** — {count} items")

        lines.append("")
        lines.append("## Full Plan Data")
        lines.append("")
        import json
        for field in ["market_analysis", "positioning", "offer", "funnel", "ad_strategy", "execution_roadmap"]:
            data = state.get(field)
            if data:
                lines.append(f"### {field}")
                lines.append("```json")
                lines.append(json.dumps(data, ensure_ascii=False, indent=2)[:3000])
                lines.append("```")
                lines.append("")

        md_path.write_text("\n".join(lines), encoding="utf-8")

        print(f"\n{'='*70}")
        print(f"✅ Hybrid plan created in {duration:.1f}s")
        print(f"   Plan ID: {new_plan.id}")
        print(f"   Report:  {md_path}")
        print(f"{'='*70}\n")

        return {"plan_id": str(new_plan.id), "md_path": str(md_path), "duration": duration}


async def main():
    args = sys.argv[1:]
    if len(args) < 3 or (args[0] == "--latest" and len(args) < 3):
        print(__doc__)
        return
    try:
        await run_hybrid(args[0], args[1], args[2])
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"\n❌ Fatal: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
