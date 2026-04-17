"""Upload an existing marketing-plan PDF, analyze it with the LLM, and optionally
turn it into a MarketingPlan row (with or without suggested improvements).

Two public entry points:
    extract_pdf_text(file_bytes) -> str
    analyze_plan_pdf(text, language) -> AnalysisResult
    build_plan_from_pdf(db, tenant_id, user_id, text, title, language, apply_improvements, improvement_ids)
"""
from __future__ import annotations

import io
import json
import logging
import re
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.llm import get_llm
from app.db.models import AgentRun, MarketingPlan

logger = logging.getLogger(__name__)


_JSON_BLOCK = re.compile(r"\{.*\}", re.DOTALL)


@dataclass
class Improvement:
    id: str
    title: str
    description: str
    severity: str  # "low" | "medium" | "high"


@dataclass
class AnalysisResult:
    summary: str
    strengths: list[str]
    weaknesses: list[str]
    improvements: list[Improvement]
    detected_sections: list[str]
    raw_text_length: int


def extract_pdf_text(file_bytes: bytes, max_chars: int = 40_000) -> str:
    """Extract plain text from an uploaded PDF. Returns '' on failure."""
    try:
        from pypdf import PdfReader
    except ImportError:
        raise RuntimeError("pypdf is not installed")

    try:
        reader = PdfReader(io.BytesIO(file_bytes))
    except Exception as e:  # noqa: BLE001
        logger.warning("Failed to open PDF: %s", e)
        return ""

    parts: list[str] = []
    total = 0
    for page in reader.pages:
        try:
            txt = page.extract_text() or ""
        except Exception:  # noqa: BLE001
            txt = ""
        if not txt:
            continue
        parts.append(txt)
        total += len(txt)
        if total > max_chars:
            break

    return "\n\n".join(parts)[:max_chars]


def _parse_json(content: str, fallback: Any) -> Any:
    if not content:
        return fallback
    text = content.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text).rsplit("```", 1)[0]
    match = _JSON_BLOCK.search(text)
    if not match:
        return fallback
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return fallback


async def analyze_plan_pdf(text: str, language: str = "ar") -> AnalysisResult:
    """Ask the LLM to analyze the uploaded plan text and suggest improvements."""
    if not text.strip():
        return AnalysisResult(
            summary="(empty)",
            strengths=[],
            weaknesses=[],
            improvements=[],
            detected_sections=[],
            raw_text_length=0,
        )

    lang_line = (
        "Respond entirely in Arabic."
        if language == "ar"
        else "Respond entirely in English."
    )
    system = (
        "You are a senior marketing strategy consultant. A client uploaded their "
        "marketing plan as a PDF. Extract what's there, identify gaps, and suggest "
        "specific improvements. Reply with a single JSON object only — no prose, "
        "no markdown. " + lang_line
    )
    user = (
        f"Marketing plan text (first ~{len(text)} chars):\n---\n{text}\n---\n\n"
        "Return JSON with these keys:\n"
        "  summary (3-sentence TL;DR of what's in the plan)\n"
        "  strengths (array of 3-5 strings — what's done well)\n"
        "  weaknesses (array of 3-5 strings — what's missing or weak)\n"
        "  improvements (array of 5-8 objects, each with: "
        "    id (short kebab-case like 'add-kpi-targets'), "
        "    title (short imperative like 'Add measurable KPI targets'), "
        "    description (2 sentences explaining why and how), "
        "    severity ('low'|'medium'|'high'))\n"
        "  detected_sections (array of section names found in the plan, e.g. "
        "    ['market_analysis', 'personas', 'channels', 'calendar', 'kpis'])\n"
    )

    llm = get_llm(model="openai/gpt-4o", temperature=0.3, max_tokens=3000)
    try:
        resp = await llm.ainvoke(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ]
        )
    except Exception as e:
        logger.exception("analyze_plan_pdf LLM call failed: %s", e)
        return AnalysisResult(
            summary="(analysis failed)",
            strengths=[],
            weaknesses=[],
            improvements=[],
            detected_sections=[],
            raw_text_length=len(text),
        )

    data = _parse_json(getattr(resp, "content", "") or "", {})
    if not isinstance(data, dict):
        data = {}

    improvements_raw = data.get("improvements") or []
    improvements: list[Improvement] = []
    for i, imp in enumerate(improvements_raw):
        if not isinstance(imp, dict):
            continue
        improvements.append(
            Improvement(
                id=str(imp.get("id") or f"imp-{i+1}"),
                title=str(imp.get("title") or ""),
                description=str(imp.get("description") or ""),
                severity=str(imp.get("severity") or "medium"),
            )
        )

    return AnalysisResult(
        summary=str(data.get("summary") or ""),
        strengths=[str(s) for s in (data.get("strengths") or []) if s],
        weaknesses=[str(s) for s in (data.get("weaknesses") or []) if s],
        improvements=improvements,
        detected_sections=[str(s) for s in (data.get("detected_sections") or []) if s],
        raw_text_length=len(text),
    )


async def structure_plan_from_pdf(
    text: str,
    language: str,
    apply_improvements: list[Improvement],
) -> dict[str, Any]:
    """Ask the LLM to convert the raw PDF text into structured plan sections,
    optionally applying the user-selected improvements."""

    lang_line = (
        "Respond entirely in Arabic."
        if language == "ar"
        else "Respond entirely in English."
    )

    imp_block = ""
    if apply_improvements:
        imp_block = (
            "\n\nApply ALL of the following improvements when structuring the plan:\n"
            + "\n".join(
                f"- {imp.title}: {imp.description}" for imp in apply_improvements
            )
            + "\n"
        )

    system = (
        "You are a marketing strategist. Convert the uploaded plan text into our "
        "canonical plan JSON schema. Keep content faithful to the original unless "
        "an improvement directs otherwise. Reply with a single JSON object only. "
        + lang_line
    )
    user = (
        f"Original plan text:\n---\n{text}\n---\n"
        f"{imp_block}\n"
        "Return JSON with these keys (any may be empty if the source doesn't cover it):\n"
        "  goals (array of strings)\n"
        "  market_analysis (object with summary, micro_market, tam/sam/som if known)\n"
        "  personas (array of 2-3 objects: name, job_to_be_done, pains[], goals[])\n"
        "  positioning (object: positioning_statement, differentiation_pillars)\n"
        "  competitors (array of strings)\n"
        "  swot (object: strengths[], weaknesses[], opportunities[], threats[])\n"
        "  channels (array of objects: channel, budget_share_pct, posting_frequency_per_week)\n"
        "  offer (object: core_offer, value_proposition, price_strategy)\n"
        "  customer_journey (object)\n"
        "  funnel (object)\n"
        "  calendar (array of 10-30 objects: day, channel, format, topic)\n"
        "  kpis (array of 5-10 objects: metric, target, unit, timeframe_days)\n"
        "  execution_roadmap (array of ordered action strings)\n"
    )

    llm = get_llm(model="openai/gpt-4o", temperature=0.3, max_tokens=6000)
    resp = await llm.ainvoke(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
    )
    data = _parse_json(getattr(resp, "content", "") or "", {})
    return data if isinstance(data, dict) else {}


async def build_plan_from_pdf(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    *,
    text: str,
    title: str,
    language: str,
    apply_improvements: list[Improvement],
    period_days: int = 30,
) -> MarketingPlan:
    """End-to-end: structure the PDF text into a plan and persist it as a draft."""

    run = AgentRun(
        tenant_id=tenant_id,
        agent_name="plan.pdf_import",
        input={"title": title, "language": language, "text_length": len(text)},
        status="running",
    )
    db.add(run)
    await db.flush()

    started = time.perf_counter()
    try:
        structured = await structure_plan_from_pdf(text, language, apply_improvements)
    except Exception as e:
        run.status = "failed"
        run.error = str(e)[:2000]
        run.latency_ms = int((time.perf_counter() - started) * 1000)
        await db.commit()
        raise

    run.status = "succeeded"
    run.output = {"sections": list(structured.keys())}
    run.latency_ms = int((time.perf_counter() - started) * 1000)

    now = datetime.now(timezone.utc)
    # swot / trends live inside market_analysis; competitors are stored in the
    # Competitor DB table (synced via business profile) — both are not columns
    # on MarketingPlan itself.
    market_analysis = structured.get("market_analysis") or {}
    if structured.get("swot"):
        market_analysis["swot"] = structured["swot"]
    if structured.get("competitors"):
        market_analysis["competitors"] = structured["competitors"]

    plan = MarketingPlan(
        tenant_id=tenant_id,
        created_by=user_id,
        title=title or "Imported plan",
        period_start=now.date(),
        period_end=(now + timedelta(days=period_days)).date(),
        status="draft",
        plan_mode="fast",
        goals=structured.get("goals") or [],
        market_analysis=market_analysis,
        personas=structured.get("personas") or [],
        positioning=structured.get("positioning") or {},
        channels=structured.get("channels") or [],
        offer=structured.get("offer") or {},
        customer_journey=structured.get("customer_journey") or {},
        funnel=structured.get("funnel") or {},
        calendar=structured.get("calendar") or [],
        kpis=structured.get("kpis") or [],
        execution_roadmap=structured.get("execution_roadmap") or [],
        version=1,
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return plan
