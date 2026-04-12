from __future__ import annotations

import json

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import BaseSubAgent


class MetricsSummarizer(BaseSubAgent):
    name = "metrics_summarizer"
    model_tier = "balanced"
    system_prompt = (
        "You are a marketing analytics writer. Given aggregated social metrics "
        "(KPIs, reach/engagement trends, top posts, leads, conversion rate), "
        "write a concise TWO-PARAGRAPH executive summary in the requested language. "
        "Be concrete: cite numbers, percentage changes, and standout posts when "
        "relevant. No headings, no bullet points, just two tight paragraphs."
    )

    async def execute(self, state):
        lang = state.get("language", "en")
        period_days = state.get("period_days", 7)
        metrics = state.get("metrics", {}) or {}
        user = (
            f"Language: {lang}\n"
            f"Period: last {period_days} days\n\n"
            f"Metrics JSON:\n{json.dumps(metrics, default=str)[:6000]}\n\n"
            "Write the 2-paragraph summary now."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        return {"summary": (resp.content or "").strip()}
