from __future__ import annotations

import json

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import parse_json_response


class ReportWriter(BaseSubAgent):
    name = "report_writer"
    model_tier = "balanced"
    system_prompt = (
        "You are a marketing strategist. Given metrics, a summary, and extracted "
        "insights, produce 3 to 5 actionable RECOMMENDATIONS — each a single, "
        "specific directive (what to do next week, and why it will move a KPI). "
        "Return STRICT JSON only: a JSON array of strings."
    )

    async def execute(self, state):
        lang = state.get("language", "en")
        metrics = state.get("metrics", {}) or {}
        summary = state.get("summary") or ""
        insights = state.get("insights") or []
        user = (
            f"Language: {lang}\n\n"
            f"Summary:\n{summary}\n\n"
            f"Insights:\n{json.dumps(insights, ensure_ascii=False)}\n\n"
            f"Metrics JSON:\n{json.dumps(metrics, default=str)[:4000]}\n\n"
            "Return the JSON array of 3-5 recommendation strings."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        data = parse_json_response(resp.content, fallback=[])
        if isinstance(data, dict):
            data = data.get("recommendations") or []
        if not isinstance(data, list):
            data = []
        recs = [str(x).strip() for x in data if str(x).strip()][:5]
        return {"recommendations": recs}
