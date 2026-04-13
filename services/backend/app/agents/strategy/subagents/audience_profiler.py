from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import (
    parse_json_response,
    lang_directive,
    budget_context,
)


class AudienceProfiler(BaseSubAgent):
    name = "audience_profiler"
    model_tier = "smart"
    system_prompt = (
        "Segment by BEHAVIOR and JOBS-TO-BE-DONE, NOT by age/gender.\n"
        "Think step-by-step:\n"
        "1. What SPECIFIC problem does each persona hire this product to solve?\n"
        "2. What alternatives (including 'doing nothing') do they use today?\n"
        "3. What TRIGGERS the purchase decision?\n"
        "4. What are 3 specific objections each persona raises?\n"
        "5. Where do they ACTUALLY spend time online? (Not 'Instagram' — 'Instagram Reels about "
        "sustainable fashion'.)\n"
        "Return STRICT JSON array of EXACTLY 3 personas. Each: {name (descriptive, e.g. 'The "
        "Gift-Rushed Corporate Buyer'), job_to_be_done, current_alternative, purchase_trigger, "
        "objections[3], buying_behavior ('high-intent search'|'impulse'|'research-heavy'|"
        "'peer-referral'), channels_actual[specific content types], "
        "willingness_to_pay_usd_range[min,max], frequency ('one-time'|'monthly'|'recurring')}.\n"
        "BANNED: generic 'engagement', 'brand-awareness' fluff."
    )

    async def execute(self, state):
        bp = state.get("business_profile", {})
        lang = state.get("language", "ar")
        market = state.get("market_analysis", {})
        user = (
            lang_directive(lang) + "\n\n"
            f"{budget_context(state)}\n\n"
            f"Business: {bp}\n"
            f"Market micro-segment: {market.get('micro_market') or market.get('summary', '')}\n"
            f"Underserved segments to consider: {market.get('underserved_segments', [])}\n\n"
            "Return 3 behavioral personas as JSON array."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        personas = parse_json_response(resp.content, fallback=[])
        if isinstance(personas, dict):
            personas = personas.get("personas", [])
        return {"personas": personas}
