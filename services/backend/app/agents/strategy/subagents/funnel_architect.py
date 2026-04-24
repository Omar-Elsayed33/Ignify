from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import (
    parse_json_response,
    lang_directive,
    budget_context,
    realism_directive,
)


class FunnelArchitect(BaseSubAgent):
    name = "funnel_architect"
    model_tier = "smart"
    system_prompt = (
        "Design the full AARRR funnel (Awareness → Acquisition → Activation → Retention → Referral).\n"
        "For EACH stage use RANGES, not point estimates: low/mid/high conversion_rate_pct, "
        "so downstream multiplication also yields a range. Real funnels vary 2-3× between good "
        "and bad execution.\n"
        "Return STRICT JSON: {reasoning, stages[{stage, what_happens, channel, "
        "conversion_rate_range_pct: {low, mid, high}, key_metric, common_leaks[], fixes[], "
        "confidence, assumptions[]}], "
        "expected_monthly_customers_range: {low, mid, high}, "
        "expected_monthly_revenue_range_usd: {low, mid, high}, "
        "math_check: str   // show the low→low and high→high multiplication explicitly}"
    )

    async def execute(self, state):
        bp = state.get("business_profile", {})
        lang = state.get("language", "ar")
        offer = state.get("offer", {})
        channels = state.get("channels", [])
        user = (
            lang_directive(lang) + "\n\n"
            + realism_directive() + "\n\n"
            f"{budget_context(state)}\n\n"
            f"Business: {bp}\nOffer: {offer}\nChannels: {channels}\n\n"
            "Return AARRR funnel JSON with realistic conversion multiplication."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        data = parse_json_response(resp.content, fallback={})
        if not isinstance(data, dict):
            data = {}
        return {"funnel": data}
