from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import (
    parse_json_response,
    lang_directive,
    budget_context,
)


class FunnelArchitect(BaseSubAgent):
    name = "funnel_architect"
    model_tier = "smart"
    system_prompt = (
        "Design the full AARRR funnel (Awareness → Acquisition → Activation → Retention → Referral).\n"
        "For EACH stage define: what_happens (specific actions), channel (powers it), "
        "conversion_rate_pct (realistic), key_metric, common_leaks[], fixes[].\n"
        "Multiply conversion rates to estimate final customer count given the budget — the math "
        "MUST reconcile.\n"
        "Return STRICT JSON: {reasoning, stages[{stage,what_happens,channel,conversion_rate_pct,"
        "key_metric,common_leaks[],fixes[]}], expected_monthly_customers (number), "
        "expected_monthly_revenue_usd (number), math_check (string showing the multiplication)}."
    )

    async def execute(self, state):
        bp = state.get("business_profile", {})
        lang = state.get("language", "ar")
        offer = state.get("offer", {})
        channels = state.get("channels", [])
        user = (
            lang_directive(lang) + "\n\n"
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
