from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import (
    parse_json_response,
    lang_directive,
    budget_context,
)


class GrowthLoops(BaseSubAgent):
    name = "growth_loops"
    model_tier = "smart"
    system_prompt = (
        "Design ONE growth loop that COMPOUNDS (not linear marketing).\n"
        "Examples: UGC loop (customer posts → attracts new customer → posts), referral loop, "
        "content-SEO loop.\n"
        "Return STRICT JSON: {reasoning, loop_name, loop_steps[ordered step1→step2→step3→back to 1],"
        " input_required (what triggers the first spin), output_amplification (how each spin creates "
        "more inputs), measurement (K-factor or loop velocity metric), "
        "expected_compounding_curve (describe linear first 30 days then exponential), "
        "tooling_needed[]}."
    )

    async def execute(self, state):
        bp = state.get("business_profile", {})
        lang = state.get("language", "ar")
        personas = state.get("personas", [])
        offer = state.get("offer", {})
        retention = state.get("retention", {})
        user = (
            lang_directive(lang) + "\n\n"
            f"{budget_context(state)}\n\n"
            f"Business: {bp}\nPersonas: {personas}\nOffer: {offer}\nRetention: {retention}\n\n"
            "Return the growth loop JSON."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        data = parse_json_response(resp.content, fallback={})
        if not isinstance(data, dict):
            data = {}
        return {"growth_loops": data}
