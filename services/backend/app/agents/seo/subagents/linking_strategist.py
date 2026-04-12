"""LinkingStrategist — proposes internal linking opportunities."""
from __future__ import annotations

import json as _json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import BaseSubAgent


class LinkingStrategist(BaseSubAgent):
    name = "linking_strategist"
    model_tier = "balanced"
    system_prompt = (
        "You are an SEO internal-linking strategist. Given a page URL and its target keywords, "
        "propose internal linking opportunities as a JSON array of "
        '{"anchor_text": "...", "target_hint": "...", "reason": "..."}. '
        "Return ONLY a JSON array."
    )

    async def execute(self, state: dict[str, Any]) -> dict[str, Any]:
        url = state.get("url") or ""
        keywords = state.get("target_keywords") or []
        lang = state.get("language", "ar")
        user = (
            f"Language: {lang}\n"
            f"Page URL: {url}\n"
            f"Keywords: {', '.join(keywords[:10])}\n\n"
            "Return up to 6 internal linking opportunities as a JSON array."
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
        return {"linking_strategy": arr}
