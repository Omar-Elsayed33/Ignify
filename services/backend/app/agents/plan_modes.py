"""Plan generation mode configuration.

Three modes define which model each subagent uses:
  fast   — all subagents use GPT-4o (quick, good quality)
  medium — Gemini for analysis/positioning, GPT-4o for execution
  deep   — Claude for strategy, Gemini for analysis, GPT-4o for execution

Superadmin can override these defaults from /admin/plan-modes.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# ── Canonical subagent names (match node names in StrategyAgent.build_graph) ──
ALL_SUBAGENTS = [
    "market",
    "audience",
    "positioning",
    "customer_journey",
    "offer",
    "funnel",
    "channels",
    "conversion",
    "retention",
    "growth_loops",
    "calendar",
    "kpis",
    "ads",
    "execution_roadmap",
]

# ── Default model assignments per mode ──
DEFAULT_MODE_CONFIG: dict[str, dict[str, str]] = {
    "fast": {s: "openai/gpt-4o" for s in ALL_SUBAGENTS},
    "medium": {
        # Deep analysis & positioning → Gemini
        "market": "google/gemini-2.5-flash",
        "audience": "google/gemini-2.5-flash",
        "positioning": "google/gemini-2.5-flash",
        "customer_journey": "google/gemini-2.5-flash",
        # Funnel, conversion, ads → GPT-4o
        "offer": "openai/gpt-4o",
        "funnel": "openai/gpt-4o",
        "channels": "openai/gpt-4o",
        "conversion": "openai/gpt-4o",
        "retention": "openai/gpt-4o",
        "growth_loops": "openai/gpt-4o",
        # Review & optimization → GPT-4o
        "calendar": "openai/gpt-4o",
        "kpis": "openai/gpt-4o",
        "ads": "openai/gpt-4o",
        "execution_roadmap": "openai/gpt-4o",
    },
    "deep": {
        # Strategy → Claude
        "positioning": "anthropic/claude-sonnet-4-5",
        "customer_journey": "anthropic/claude-sonnet-4-5",
        "offer": "anthropic/claude-sonnet-4-5",
        "funnel": "anthropic/claude-sonnet-4-5",
        # Analysis → Gemini
        "market": "google/gemini-2.5-flash",
        "audience": "google/gemini-2.5-flash",
        "retention": "google/gemini-2.5-flash",
        "growth_loops": "google/gemini-2.5-flash",
        # Execution → GPT-4o
        "channels": "openai/gpt-4o",
        "conversion": "openai/gpt-4o",
        "calendar": "openai/gpt-4o",
        "kpis": "openai/gpt-4o",
        "ads": "openai/gpt-4o",
        "execution_roadmap": "openai/gpt-4o",
    },
}


async def load_mode_config(db: AsyncSession, mode: str) -> dict[str, str]:
    """Return {subagent_name: model} for the given mode.

    Reads from DB first; falls back to DEFAULT_MODE_CONFIG if the table is
    empty or the mode has no rows yet.
    """
    from app.db.models import PlanModeConfig  # local import to avoid circular

    result = await db.execute(
        select(PlanModeConfig).where(PlanModeConfig.mode == mode)
    )
    rows = result.scalars().all()

    if rows:
        return {r.subagent_name: r.model for r in rows}

    return DEFAULT_MODE_CONFIG.get(mode, DEFAULT_MODE_CONFIG["fast"])


async def seed_default_mode_configs(db: AsyncSession) -> None:
    """Insert default mode configs if the table is empty. Call on app startup."""
    from app.db.models import PlanModeConfig

    existing = (await db.execute(select(PlanModeConfig))).scalars().first()
    if existing:
        return  # already seeded

    for mode, subagent_map in DEFAULT_MODE_CONFIG.items():
        for subagent_name, model in subagent_map.items():
            db.add(PlanModeConfig(mode=mode, subagent_name=subagent_name, model=model))

    await db.commit()
