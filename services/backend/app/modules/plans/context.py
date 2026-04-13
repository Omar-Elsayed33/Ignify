"""Build a compact, LLM-ready context string from an approved marketing plan.

Used by content-gen / creative-gen / video-gen when the user generates
content while linked to a specific plan (via ?plan_id=).
"""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import MarketingPlan


def _truncate(val: Any, limit: int = 400) -> str:
    s = str(val) if val is not None else ""
    return s[:limit] + ("…" if len(s) > limit else "")


def _personas_summary(personas: Any) -> str:
    if not isinstance(personas, list):
        return ""
    out = []
    for p in personas[:3]:
        if not isinstance(p, dict):
            continue
        name = p.get("name") or p.get("role") or "persona"
        pains = p.get("pains") or p.get("pain_points") or p.get("objections") or []
        goal = p.get("job_to_be_done") or p.get("goals") or ""
        if isinstance(pains, list):
            pains = ", ".join(str(x) for x in pains[:3])
        out.append(f"- {name}: goal={_truncate(goal, 120)}; pains={_truncate(pains, 120)}")
    return "\n".join(out)


def _channels_summary(channels: Any) -> str:
    if not isinstance(channels, list):
        return ""
    names = []
    for c in channels[:6]:
        if isinstance(c, dict):
            names.append(str(c.get("channel") or c.get("name") or ""))
        elif isinstance(c, str):
            names.append(c)
    return ", ".join([n for n in names if n])


def build_plan_context(plan: MarketingPlan, language: str = "ar") -> str:
    """Return a compact context block (< ~1500 chars) describing the plan's
    strategic decisions. Goes into LLM prompts so generated content aligns
    with the approved strategy."""
    parts: list[str] = []

    parts.append(f"=== Linked Marketing Plan: {plan.title} ===")

    positioning = getattr(plan, "positioning", None)
    if positioning:
        if isinstance(positioning, dict):
            stmt = positioning.get("positioning_statement") or positioning.get("summary") or positioning
            parts.append(f"Positioning: {_truncate(stmt, 300)}")
        else:
            parts.append(f"Positioning: {_truncate(positioning, 300)}")

    primary_goal = getattr(plan, "primary_goal", None)
    if primary_goal:
        parts.append(f"Primary goal: {_truncate(primary_goal, 200)}")

    goals = plan.goals
    if goals:
        parts.append(f"Goals: {_truncate(goals, 300)}")

    personas_txt = _personas_summary(plan.personas)
    if personas_txt:
        parts.append(f"Target personas:\n{personas_txt}")

    ch_txt = _channels_summary(plan.channels)
    if ch_txt:
        parts.append(f"Active channels: {ch_txt}")

    offer = getattr(plan, "offer", None)
    if offer:
        if isinstance(offer, dict):
            core = offer.get("core_offer") or offer.get("value_proposition") or ""
            if core:
                parts.append(f"Core offer: {_truncate(core, 250)}")

    market = plan.market_analysis
    if isinstance(market, dict):
        summary = market.get("summary") or market.get("micro_market")
        if summary:
            parts.append(f"Market: {_truncate(summary, 250)}")

    if language == "ar":
        parts.append(
            "Instructions: Keep every generated piece consistent with the positioning, "
            "personas, and tone above. Write content in Arabic."
        )
    else:
        parts.append(
            "Instructions: Keep every generated piece consistent with the positioning, "
            "personas, and tone above."
        )
    return "\n\n".join(parts)


async def fetch_plan_context(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    plan_id: uuid.UUID | None,
    language: str = "ar",
) -> str:
    """Look up a plan by id (scoped to tenant) and return its context string.
    Returns empty string when plan_id is None or plan is not found."""
    if not plan_id:
        return ""
    result = await db.execute(
        select(MarketingPlan).where(
            MarketingPlan.id == plan_id, MarketingPlan.tenant_id == tenant_id
        )
    )
    plan = result.scalar_one_or_none()
    if not plan:
        return ""
    return build_plan_context(plan, language)
