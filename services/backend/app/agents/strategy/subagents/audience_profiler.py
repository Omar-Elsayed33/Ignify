from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import parse_json_response


class AudienceProfiler(BaseSubAgent):
    name = "audience_profiler"
    model_tier = "balanced"
    system_prompt = (
        "Build 3 detailed buyer personas for the business. "
        "Return STRICT JSON array. Each persona: {name, age_range, role, goals[], pains[], channels[], objections[]}."
    )

    async def execute(self, state):
        bp = state.get("business_profile", {})
        lang = state.get("language", "ar")
        market = state.get("market_analysis", {})
        user = (
            f"Language: {lang}\n"
            f"Business: {bp}\n"
            f"Market context: {market.get('summary', '')}\n\n"
            "Return 3 personas as JSON array."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        personas = parse_json_response(resp.content, fallback=[])
        if isinstance(personas, dict):
            personas = personas.get("personas", [])
        return {"personas": personas}
