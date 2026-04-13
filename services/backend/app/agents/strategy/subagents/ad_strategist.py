"""AdStrategist — budget-capped paid media plan."""
from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import (
    parse_json_response,
    lang_directive,
    budget_context,
    constraint_directive,
)


class AdStrategist(BaseSubAgent):
    name = "ad_strategist"
    model_tier = "smart"
    system_prompt = (
        "You are a senior paid-media strategist. ⚠️ STRICT BUDGET RULE: recommended_monthly_budget_usd "
        "MUST NOT exceed the user's monthly budget. If budget is $0 — return ONLY organic strategies "
        "with zero USD in paid lines. If budget is under $500, focus on ONE channel (usually IG+WA "
        "for MENA) with highest ROI.\n"
        "Think: 1) With $X, realistic monthly leads using MENA benchmarks (~$5-15 CPL Meta retail). "
        "2) MVP ad setup with concrete structure (CBO, adsets, daily budget). 3) What to DROP at this "
        "budget.\n"
        "Return STRICT JSON with keys: platform_recommendations[{platform,score,budget_share_pct,"
        "rationale}], recommended_monthly_budget_usd (<= user budget), alternative_budgets[3 tiers: "
        "'Go organic' at 0, 'Lean' at ~50% of budget, 'User budget' at full], budget_breakdown"
        "{facebook_ads,google_ads,content_production,tools}, expected_roi{cost_per_lead_usd,"
        "cost_per_customer_usd,break_even_customers}, what_to_skip_for_this_budget[], "
        "funnel_projection{impressions,clicks,leads,customers}, monthly_projections[M1,M2,M3 with "
        "leads/customers/revenue_usd], reasoning_ar, reasoning_en.\n"
        "reasoning_ar MUST be Arabic; reasoning_en MUST be English. budget_share_pct values sum to ~100.\n"
        "\nRequired output additions:\n"
        "- `scenarios`: {conservative, expected, aggressive} — each with {budget_usd, impressions, "
        "clicks, leads, customers, revenue_usd, roas}\n"
        "- `cac_usd`: Customer Acquisition Cost\n"
        "- `ltv_usd`: Lifetime Value (estimate from repeat rate × avg order value × gross margin)\n"
        "- `payback_months`: CAC / (monthly net revenue per customer)\n"
        "- `channel_intent_mix`: {high_intent: [google_search, sem], passive: [instagram_reels, "
        "tiktok], warm: [whatsapp_broadcast, referral_program]}\n"
        "The AI must EXCEED budget only in the aggressive scenario. Never exceed 2x user budget."
    )

    async def execute(self, state):
        bp = state.get("business_profile", {})
        channels = state.get("channels", [])
        kpis = state.get("kpis", [])
        personas = state.get("personas", [])
        lang = state.get("language", "ar")
        budget = state.get("budget_monthly_usd") if state.get("budget_monthly_usd") is not None else 500.0
        user = (
            lang_directive(lang) + "\n\n"
            + constraint_directive() + "\n\n"
            f"{budget_context(state)}\n\n"
            f"Business: {bp}\nChannels: {channels}\nPersonas: {personas}\nKPIs: {kpis}\n\n"
            f"⚠️ DO NOT exceed ${budget:.0f}/mo. Return the full ad strategy JSON."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        data = parse_json_response(resp.content, fallback={
            "platform_recommendations": [],
            "recommended_monthly_budget_usd": 0,
            "alternative_budgets": [],
            "budget_breakdown": {},
            "expected_roi": {},
            "what_to_skip_for_this_budget": [],
            "funnel_projection": {},
            "monthly_projections": [],
            "scenarios": {},
            "cac_usd": 0,
            "ltv_usd": 0,
            "payback_months": 0,
            "channel_intent_mix": {},
            "reasoning_ar": "",
            "reasoning_en": "",
        })
        if not isinstance(data, dict):
            data = {}
        # Enforce budget cap defensively
        try:
            if data.get("recommended_monthly_budget_usd", 0) and float(data["recommended_monthly_budget_usd"]) > budget:
                data["recommended_monthly_budget_usd"] = float(budget)
        except Exception:
            pass
        return {"ad_strategy": data}
