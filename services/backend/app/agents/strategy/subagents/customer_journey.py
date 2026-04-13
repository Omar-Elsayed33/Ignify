from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import (
    parse_json_response,
    lang_directive,
    budget_context,
)


class CustomerJourney(BaseSubAgent):
    name = "customer_journey"
    model_tier = "balanced"
    system_prompt = (
        "Map the customer journey from first exposure to advocate.\n"
        "Return STRICT JSON: {stages[{stage ('unaware'|'problem-aware'|'solution-aware'|"
        "'product-aware'|'customer'|'advocate'), emotions, thoughts, touchpoints[specific "
        "channel/content], decision_triggers[], objections[], friction_points[], "
        "ideal_content_for_this_stage}], critical_moments[top 3 decision moments that must be "
        "nailed]}.\n"
        "Be concrete. Map to real channels the personas use."
    )

    async def execute(self, state):
        bp = state.get("business_profile", {})
        lang = state.get("language", "ar")
        personas = state.get("personas", [])
        positioning = state.get("positioning", {})
        user = (
            lang_directive(lang) + "\n\n"
            f"{budget_context(state)}\n\n"
            f"Business: {bp}\nPersonas: {personas}\nPositioning: {positioning}\n\n"
            "Return the customer journey JSON."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        data = parse_json_response(resp.content, fallback={})
        if not isinstance(data, dict):
            data = {}
        return {"customer_journey": data}
