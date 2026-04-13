"""Shared helpers for strategy sub-agents."""
from __future__ import annotations

import json
import re
from typing import Any


JSON_BLOCK = re.compile(r"```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```", re.DOTALL)


_LANG_DIRECTIVES = {
    "ar": (
        "⚠️ CRITICAL: Respond ENTIRELY in Arabic (العربية). ALL text fields, names, "
        "descriptions, summaries, personas, topics, hooks, CTAs, and any narrative "
        "content MUST be in Arabic. JSON keys stay English; VALUES must be Arabic. "
        "No English words anywhere in values except brand names and acronyms."
    ),
    "en": "Respond entirely in English.",
    "both": (
        "Provide values in Arabic first, then English in parentheses. "
        "e.g., 'شباب 25-35 (Young adults 25-35)'."
    ),
}


def lang_directive(lang: str) -> str:
    """Return a strong, language-enforcing prefix for the user message."""
    return _LANG_DIRECTIVES.get(lang, _LANG_DIRECTIVES["en"])


CONSTRAINT_DIRECTIVE = """
⚠️ HARD CONSTRAINTS — NEVER VIOLATE:
1. Budget: stay within the user's monthly budget. If missing, assume $500/mo.
2. Team capacity: assume solo founder or team of 2-3 unless specified. Don't recommend strategies requiring 10 people.
3. Realistic numbers: use industry benchmarks for MENA SMB (CPL $3-$15, CAC $50-$200, retention 60-80%).
4. 3 scenarios always: conservative (80% confidence), expected (50%), aggressive (20%).
5. Every recommendation must have a specific, measurable expected outcome.
6. No generic filler: "engage with audience", "increase brand awareness" are BANNED unless attached to specific numbers.
"""


def constraint_directive() -> str:
    """Universal hard-constraint directive prepended to every sub-agent prompt."""
    return CONSTRAINT_DIRECTIVE


def budget_context(state: dict) -> str:
    """Formatted budget/goal/urgency block to inject into every sub-agent prompt."""
    budget = state.get("budget_monthly_usd")
    if budget is None:
        budget = 500.0  # sensible default when user skipped
    currency = state.get("budget_currency", "usd")
    primary_goal = state.get("primary_goal") or "(not specified — infer from business profile)"
    urgency = state.get("urgency_days", 30)
    return (
        f"Monthly marketing budget: ${budget:.0f} USD (source currency: {currency.upper()})\n"
        f"Primary goal (next {urgency} days): {primary_goal}\n"
        f"Urgency: results needed within {urgency} days."
    )


def parse_json_response(content: str, fallback: Any) -> Any:
    """Extract JSON from LLM response, tolerating code fences and prose."""
    if not content:
        return fallback

    match = JSON_BLOCK.search(content)
    raw = match.group(1) if match else content.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Try to locate first {...} or [...] block
        for opener, closer in (("{", "}"), ("[", "]")):
            start = raw.find(opener)
            end = raw.rfind(closer)
            if start != -1 and end > start:
                try:
                    return json.loads(raw[start : end + 1])
                except json.JSONDecodeError:
                    continue
        return fallback
