from __future__ import annotations

import json

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import parse_json_response


class InsightsGenerator(BaseSubAgent):
    name = "insights_generator"
    model_tier = "smart"
    system_prompt = (
        "You are a senior marketing analyst. Given aggregated marketing metrics "
        "and a short summary, produce 3 to 5 SHARP insights — each insight a "
        "single, specific sentence grounded in the numbers. "
        "Return STRICT JSON only: a JSON array of strings. No prose outside the array."
    )

    async def execute(self, state):
        lang = state.get("language", "en")
        metrics = state.get("metrics", {}) or {}
        summary = state.get("summary") or ""
        user = (
            f"Language: {lang}\n\n"
            f"Summary so far:\n{summary}\n\n"
            f"Metrics JSON:\n{json.dumps(metrics, default=str)[:6000]}\n\n"
            "Return the JSON array of 3-5 insight strings."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        data = parse_json_response(resp.content, fallback=[])
        if isinstance(data, dict):
            data = data.get("insights") or []
        if not isinstance(data, list):
            data = []
        insights = [str(x).strip() for x in data if str(x).strip()][:5]
        return {"insights": insights}
