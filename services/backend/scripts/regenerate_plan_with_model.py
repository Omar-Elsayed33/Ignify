"""Regenerate a marketing plan with one or more models, produce per-model .md
reports and a comparison.md with scores.

Usage:
    python scripts/regenerate_plan_with_model.py --latest <model>
    python scripts/regenerate_plan_with_model.py <plan_id> <model>
    python scripts/regenerate_plan_with_model.py --compare <plan_id> <m1> <m2> <m3> ...
"""
import asyncio
import os
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

# Use in-memory checkpointer for the CLI (AsyncPostgresSaver needs an open
# context manager which doesn't fit one-shot script usage).
os.environ["DEBUG"] = "true"

from sqlalchemy import select, desc  # noqa: E402
from app.db.database import async_session  # noqa: E402
from app.db.models import MarketingPlan  # noqa: E402
from app.agents.registry import get_agent  # noqa: E402
from app.agents.tracing import AgentTracer  # noqa: E402
from app.modules.plans.service import _build_business_profile  # noqa: E402

REPORTS_DIR = Path("/app/reports/model_compare")
REPORTS_DIR.mkdir(parents=True, exist_ok=True)


def _safe(s: str) -> str:
    return "".join(c if c.isalnum() or c in "-_." else "_" for c in s)[:60]


def _one_line(v) -> str:
    if v is None:
        return "—"
    if isinstance(v, str):
        return v
    if isinstance(v, (int, float, bool)):
        return str(v)
    if isinstance(v, list):
        return "، ".join(_one_line(x) for x in v)
    if isinstance(v, dict):
        return "; ".join(f"{k}: {_one_line(val)}" for k, val in v.items())
    return str(v)


def _format_section(name: str, data) -> str:
    if data is None or (isinstance(data, (list, dict)) and not data):
        return f"### {name}\n*— empty —*\n\n"
    out = [f"### {name}\n"]
    if isinstance(data, str):
        out.append(data)
    elif isinstance(data, list):
        for i, item in enumerate(data, 1):
            if isinstance(item, dict):
                out.append(f"**Item {i}**")
                for k, v in item.items():
                    out.append(f"- **{k.replace('_', ' ')}:** {_one_line(v)}")
            else:
                out.append(f"- {_one_line(item)}")
            out.append("")
    elif isinstance(data, dict):
        for k, v in data.items():
            if isinstance(v, (list, dict)) and v:
                out.append(f"**{k.replace('_', ' ').title()}**")
                if isinstance(v, list):
                    for idx, x in enumerate(v[:10], 1):
                        out.append(f"  {idx}. {_one_line(x)}")
                else:
                    for kk, vv in v.items():
                        out.append(f"  - **{kk}:** {_one_line(vv)}")
                out.append("")
            else:
                out.append(f"- **{k.replace('_', ' ')}:** {_one_line(v)}")
        out.append("")
    out.append("")
    return "\n".join(out)


def _score_plan(data: dict) -> dict:
    EXPECTED = [
        "market_analysis", "personas", "positioning", "customer_journey",
        "offer", "funnel", "channels", "conversion", "retention",
        "growth_loops", "calendar", "kpis", "ad_strategy", "execution_roadmap",
    ]
    present = sum(1 for k in EXPECTED if data.get(k))
    comprehensiveness = round((present / len(EXPECTED)) * 100)

    text = str(data).lower()
    accuracy_keys = [
        "cac", "ltv", "conversion_rate", "budget", "payback", "roas",
        "cost_per_lead", "impressions", "customer", "scenarios",
    ]
    hits = sum(1 for k in accuracy_keys if k in text)
    accuracy = min(100, hits * 10)

    generic = ["engage with audience", "high quality content", "brand awareness", "leverage"]
    generic_hits = sum(text.count(g) for g in generic)
    reasoning_hits = text.count('"reasoning"')
    prof_raw = (reasoning_hits * 8) - (generic_hits * 3) + 40
    professionalism = max(0, min(100, prof_raw))

    overall = round((comprehensiveness + accuracy + professionalism) / 3)
    return {
        "comprehensiveness": comprehensiveness,
        "accuracy": accuracy,
        "professionalism": professionalism,
        "overall": overall,
        "sections_present": present,
        "sections_expected": len(EXPECTED),
    }


def _write_md(model: str, result: dict, duration_s: float, plan_id: str, tokens: int, original_title: str, scores: dict) -> Path:
    safe = _safe(model.replace("/", "_"))
    path = REPORTS_DIR / f"{safe}.md"

    lines = [
        f"# Marketing Plan — {model}",
        "",
        "| | |",
        "|---|---|",
        f"| **Source plan** | `{plan_id}` |",
        f"| **Original title** | {original_title} |",
        f"| **Model** | `{model}` |",
        f"| **Generated at** | {datetime.utcnow().isoformat()}Z |",
        f"| **Duration** | {duration_s:.1f}s |",
        f"| **Total tokens** | {tokens:,} |",
        "",
        "## 📊 Score",
        "",
        "| Metric | Score |",
        "|---|---|",
        f"| Comprehensiveness | **{scores['comprehensiveness']}/100** ({scores['sections_present']}/{scores['sections_expected']} sections) |",
        f"| Accuracy (quantitative signals) | **{scores['accuracy']}/100** |",
        f"| Professionalism | **{scores['professionalism']}/100** |",
        f"| **Overall** | **{scores['overall']}/100** |",
        "",
        "---",
        "",
    ]

    section_titles = [
        ("market_analysis", "🌍 Market Analysis"),
        ("personas", "👥 Personas"),
        ("positioning", "🎯 Positioning"),
        ("customer_journey", "🧭 Customer Journey"),
        ("offer", "💼 Offer Strategy"),
        ("funnel", "🪣 AARRR Funnel"),
        ("channels", "📢 Channels"),
        ("conversion", "⚡ Conversion System"),
        ("retention", "🔄 Retention"),
        ("growth_loops", "♻️ Growth Loops"),
        ("calendar", "📅 Content Calendar (first 10)"),
        ("kpis", "📈 KPIs"),
        ("ad_strategy", "💰 Ad Strategy"),
        ("execution_roadmap", "🗓 Execution Roadmap (first 10)"),
    ]

    for key, label in section_titles:
        data = result.get(key)
        if data is None:
            continue
        if isinstance(data, list) and key in {"calendar", "execution_roadmap"}:
            data = data[:10]
        lines.append(_format_section(label, data))

    path.write_text("\n".join(lines), encoding="utf-8")
    return path


async def regenerate(plan_id: str, model_id: str) -> dict:
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

        state_input = {
            "tenant_id": str(tenant_id),
            "business_profile": profile,
            "language": "ar",
            "period_days": period_days,
            "budget_monthly_usd": 500,
            "budget_currency": "USD",
            "primary_goal": original.title,
            "urgency_days": 30,
        }

        print(f"▶ {model_id} — running StrategyAgent…", flush=True)
        tracer = AgentTracer(tenant_id=tenant_id, run_id=uuid.uuid4())
        started = time.perf_counter()

        agent = get_agent("strategy", str(tenant_id), model_override=model_id)
        result = await agent.run(state_input, thread_id=f"cmp:{original.id}:{model_id}", tracer=tracer)
        duration = time.perf_counter() - started

        tokens = sum((t.get("tokens_in") or 0) + (t.get("tokens_out") or 0) for t in tracer.traces)
        scores = _score_plan(result)

        md_path = _write_md(
            model=model_id, result=result, duration_s=duration,
            plan_id=str(original.id), tokens=tokens,
            original_title=original.title, scores=scores,
        )

        print(f"✅ {model_id} done in {duration:.1f}s — tokens={tokens:,} → {md_path}", flush=True)
        print(f"   Scores: comp={scores['comprehensiveness']} acc={scores['accuracy']} prof={scores['professionalism']} | overall={scores['overall']}/100", flush=True)

        return {
            "model": model_id, "duration": duration, "tokens": tokens,
            "scores": scores, "md_path": str(md_path), "result": result,
            "plan_id": str(original.id), "original_title": original.title,
        }


def _write_comparison(runs: list, plan_id: str) -> Path:
    path = REPORTS_DIR / "comparison.md"
    runs_ok = [r for r in runs if r]
    ranked = sorted(runs_ok, key=lambda r: r["scores"]["overall"], reverse=True)
    medals = ["🥇", "🥈", "🥉"] + ["·"] * 10

    lines = [
        "# 🏆 Model Comparison — Marketing Plan Generation",
        "",
        f"**Source plan:** `{plan_id}`  ",
        f"**Generated at:** {datetime.utcnow().isoformat()}Z  ",
        f"**Models compared:** {len(runs_ok)}",
        "",
        "## Ranking",
        "",
        "| Rank | Model | Overall | Comprehensiveness | Accuracy | Professionalism | Duration | Tokens |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for i, r in enumerate(ranked):
        s = r["scores"]
        lines.append(
            f"| {medals[i]} {i+1} | `{r['model']}` | **{s['overall']}/100** | {s['comprehensiveness']} | {s['accuracy']} | {s['professionalism']} | {r['duration']:.1f}s | {r['tokens']:,} |"
        )

    lines.extend([
        "",
        "## Section Coverage",
        "",
        "| Section | " + " | ".join(f"`{r['model'].split('/')[-1]}`" for r in runs_ok) + " |",
        "|---|" + "|".join(["---"] * len(runs_ok)) + "|",
    ])

    EXPECTED = [
        "market_analysis", "personas", "positioning", "customer_journey", "offer",
        "funnel", "channels", "conversion", "retention", "growth_loops",
        "calendar", "kpis", "ad_strategy", "execution_roadmap",
    ]
    for key in EXPECTED:
        row = [f"**{key.replace('_', ' ')}**"]
        for r in runs_ok:
            v = r["result"].get(key)
            if not v:
                row.append("❌")
            elif isinstance(v, list):
                row.append(f"✅ {len(v)}")
            elif isinstance(v, dict):
                row.append(f"✅ {len(v)} keys")
            else:
                row.append("✅")
        lines.append("| " + " | ".join(row) + " |")

    lines.extend([
        "",
        "## Per-model reports",
        "",
    ])
    for r in runs_ok:
        lines.append(f"- **{r['model']}** → [{Path(r['md_path']).name}]({Path(r['md_path']).name})")

    lines.extend([
        "",
        "## Interpretation",
        "",
        "- **Comprehensiveness** = % of 14 strategic sections produced non-empty.",
        "- **Accuracy** = presence of concrete quantitative signals (CAC, LTV, conversion rates, payback, budget).",
        "- **Professionalism** = frequency of `reasoning` fields minus generic filler phrases.",
    ])

    path.write_text("\n".join(lines), encoding="utf-8")
    print(f"\n📄 Comparison report: {path}", flush=True)
    return path


async def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return

    try:
        if args[0] == "--compare" and len(args) >= 3:
            plan_id = args[1]
            models = args[2:]
            runs = []
            for m in models:
                try:
                    runs.append(await regenerate(plan_id, m))
                except Exception as e:
                    print(f"❌ {m} failed: {e}", flush=True)
                    runs.append(None)
            _write_comparison(runs, plan_id)
        elif args[0] == "--latest" and len(args) >= 2:
            await regenerate("--latest", args[1])
        elif len(args) >= 2:
            await regenerate(args[0], args[1])
        else:
            print(__doc__)
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"\n❌ Fatal: {e}", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
