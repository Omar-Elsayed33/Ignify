"""GapFinder — turns a competitor analysis into actionable strengths,
weaknesses, and positioning gaps vs. our brand.

Phase 2.5 upgrade:
- Output now includes:
  * competitor_strengths — what they do well (we must match or flank)
  * competitor_weaknesses — what they're missing (we can exploit)
  * positioning_gaps — segments/messages they don't own
  * gap_opportunities (legacy) — actionable ideas with impact tier
"""
from __future__ import annotations

import json as _json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import BaseSubAgent
from app.core.ai_guardrails import realism_block


class GapFinder(BaseSubAgent):
    name = "competitor_gap_finder"
    model_tier = "smart"
    system_prompt = (
        "You are a competitive strategist. Given a competitor's structured analysis and "
        "our brand context, return a JSON object with strengths, weaknesses, positioning gaps, "
        "and concrete opportunities we can take.\n\n"
        "Schema:\n"
        "{\n"
        '  "competitor_strengths": [\n'
        '    { "claim": str, "evidence": str, "severity": "high"|"medium"|"low" }\n'
        '  ],                                   // what they do well — we must match or flank\n'
        '  "competitor_weaknesses": [\n'
        '    { "claim": str, "evidence": str, "exploitability": "high"|"medium"|"low" }\n'
        '  ],                                   // what they lack — we can exploit\n'
        '  "positioning_gaps": [\n'
        '    { "segment_or_angle": str, "why_unowned": str, "how_to_claim": str }\n'
        '  ],                                   // white space they haven\'t claimed\n'
        '  "gap_opportunities": [\n'
        '    { "opportunity": str, "rationale": str, "action": str,\n'
        '      "impact": "high"|"medium"|"low", "assumptions": [str, ...] }\n'
        '  ]\n'
        "}\n\n"
        "RULES:\n"
        " - Use the EVIDENCE field to cite specifics from the competitor analysis "
        "(e.g. 'no visible pricing', 'testimonials are stock photos', 'no Arabic content').\n"
        " - Never claim a competitor is weak without concrete evidence.\n"
        " - Positioning gaps must be actionable — specify how to claim it.\n"
        " - Realism: opportunities must include `assumptions` (what must be true to act on them).\n"
        " - Return ONLY the JSON object; no prose, no markdown fences.\n\n"
        + realism_block()
    )

    async def execute(self, state: dict[str, Any]) -> dict[str, Any]:
        analysis = state.get("analysis") or {}
        our_brand = state.get("our_brand") or {}
        lang = state.get("language", "ar")
        user = (
            f"Language for text values: {lang}\n\n"
            f"Competitor analysis:\n{_json.dumps(analysis, ensure_ascii=False)[:3000]}\n\n"
            f"Our brand:\n{_json.dumps(our_brand, ensure_ascii=False)[:1500]}\n\n"
            "Return the JSON object matching the schema exactly. "
            "Aim for 3-5 items per array — quality over quantity."
        )
        try:
            resp = await self.llm.ainvoke(
                [SystemMessage(content=self.system_prompt), HumanMessage(content=user)]
            )
            text = (resp.content or "").strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                text = text.rsplit("```", 1)[0]
            data = _json.loads(text)
            # Backward compat: older callers expected a flat array at `gaps`;
            # return both shapes so nothing breaks.
            if isinstance(data, list):
                return {"gaps": data, "competitor_strengths": [],
                        "competitor_weaknesses": [], "positioning_gaps": [],
                        "gap_opportunities": data}
            if not isinstance(data, dict):
                data = {}
        except Exception:  # noqa: BLE001
            data = {}

        # Normalize shape
        data.setdefault("competitor_strengths", [])
        data.setdefault("competitor_weaknesses", [])
        data.setdefault("positioning_gaps", [])
        opportunities = data.setdefault("gap_opportunities", [])

        # Preserve the legacy `gaps` key (was a flat array) so existing code
        # reading state["gaps"] doesn't start returning empty.
        return {
            **data,
            "gaps": opportunities,
        }
