from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import (
    parse_json_response,
    lang_directive,
    budget_context,
)


class PositioningStrategist(BaseSubAgent):
    name = "positioning_strategist"
    model_tier = "smart"
    system_prompt = (
        "Define positioning + differentiation. Think step-by-step, then output JSON.\n"
        "Return STRICT JSON: {reasoning, value_proposition (ONE sentence passing 'so what?'), "
        "positioning_statement (template: 'For [segment] who [need], [Brand] is the [category] that "
        "[key benefit] unlike [competitor] which [weakness].'), differentiation_pillars[{pillar,proof}], "
        "price_strategy ('premium'|'competitive'|'penetration'), brand_archetype, "
        "tagline_options[3 taglines with 'tagline' and 'reasoning']}.\n"
        "No clichés ('best quality', 'trusted'). Everything must reference the real competitors + gap."
    )

    async def execute(self, state):
        bp = state.get("business_profile", {})
        lang = state.get("language", "ar")
        market = state.get("market_analysis", {})
        personas = state.get("personas", [])
        user = (
            lang_directive(lang) + "\n\n"
            f"{budget_context(state)}\n\n"
            f"Business: {bp}\nCompetitors: {market.get('competitors', [])}\n"
            f"Personas: {personas}\nUnderserved: {market.get('underserved_segments', [])}\n\n"
            "Return the positioning JSON."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        data = parse_json_response(resp.content, fallback={})
        if not isinstance(data, dict):
            data = {}
        return {"positioning": data}
