"""GapFinder — compares competitor themes vs our brand, finds opportunities."""
from __future__ import annotations

import json as _json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import BaseSubAgent


class GapFinder(BaseSubAgent):
    name = "competitor_gap_finder"
    model_tier = "smart"
    system_prompt = (
        "You are a competitive strategist. Given a competitor's analysis and our brand, "
        "return a JSON array of content/positioning gaps we can exploit. Each item: "
        '{"opportunity": "...", "rationale": "...", "action": "...", '
        '"impact": "high|medium|low"}. Return ONLY a JSON array.'
    )

    async def execute(self, state: dict[str, Any]) -> dict[str, Any]:
        analysis = state.get("analysis") or {}
        our_brand = state.get("our_brand") or {}
        lang = state.get("language", "ar")
        user = (
            f"Language: {lang}\n"
            f"Competitor analysis:\n{_json.dumps(analysis, ensure_ascii=False)[:2000]}\n\n"
            f"Our brand:\n{_json.dumps(our_brand, ensure_ascii=False)[:1500]}\n\n"
            "Return 3–6 gap opportunities as JSON array."
        )
        try:
            resp = await self.llm.ainvoke(
                [SystemMessage(content=self.system_prompt), HumanMessage(content=user)]
            )
            text = (resp.content or "").strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                text = text.rsplit("```", 1)[0]
            arr = _json.loads(text)
            if not isinstance(arr, list):
                arr = []
        except Exception:  # noqa: BLE001
            arr = []
        return {"gaps": arr}
