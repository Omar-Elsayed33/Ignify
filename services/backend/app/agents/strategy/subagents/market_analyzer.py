from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import parse_json_response


class MarketAnalyzer(BaseSubAgent):
    name = "market_analyzer"
    model_tier = "balanced"
    system_prompt = (
        "You are a senior marketing strategist. Analyze the business's market, "
        "top 3 competitors, SWOT, and key trends. Respond in the requested language. "
        "Return STRICT JSON only with keys: summary, competitors[3], swot{strengths[],weaknesses[],opportunities[],threats[]}, trends[]."
    )

    async def execute(self, state):
        bp = state.get("business_profile", {})
        lang = state.get("language", "ar")
        user = (
            f"Language: {lang}\n"
            f"Business profile:\n{bp}\n\n"
            "Produce the market analysis JSON."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        data = parse_json_response(resp.content, fallback={
            "summary": "", "competitors": [], "swot": {}, "trends": []
        })
        return {"market_analysis": data}
