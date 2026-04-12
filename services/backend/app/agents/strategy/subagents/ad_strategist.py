"""AdStrategist — recommends platforms, budget tiers, and projected funnel."""
from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import parse_json_response, lang_directive


class AdStrategist(BaseSubAgent):
    name = "ad_strategist"
    model_tier = "smart"
    system_prompt = (
        "You are a senior paid-media strategist. Given a business profile, recommended channels, "
        "and KPIs, produce a concrete advertising plan: platform recommendations (with scores and "
        "budget share), three alternative monthly budgets (minimum viable, balanced, aggressive), "
        "a funnel projection (impressions → clicks → leads → customers), and 3-month growth "
        "projections. Return STRICT JSON only with keys: "
        "platform_recommendations[], recommended_monthly_budget_usd, alternative_budgets[], "
        "funnel_projection{impressions,clicks,leads,customers}, monthly_projections[], "
        "reasoning_ar, reasoning_en. "
        "CRITICAL: reasoning_ar MUST be in Arabic; reasoning_en MUST be in English. "
        "Platform scores are 0-100. budget_share_pct values across all platform_recommendations "
        "should sum to ~100. Match the user's requested language exactly for any other text."
    )

    async def execute(self, state):
        bp = state.get("business_profile", {})
        channels = state.get("channels", [])
        kpis = state.get("kpis", [])
        personas = state.get("personas", [])
        lang = state.get("language", "ar")
        user = (
            lang_directive(lang) + "\n\n"
            f"Language: {lang}\n"
            f"Business: {bp}\n"
            f"Channels: {channels}\n"
            f"Personas: {personas}\n"
            f"KPIs: {kpis}\n\n"
            "Return the full ad strategy JSON with platform_recommendations (top 3-5), "
            "recommended_monthly_budget_usd (integer), alternative_budgets (exactly 3 tiers: "
            "'Minimum viable', 'Balanced', 'Aggressive' each with usd/expected_reach/expected_leads), "
            "funnel_projection, monthly_projections (M1, M2, M3 with leads/customers/revenue_usd), "
            "reasoning_ar, and reasoning_en."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        data = parse_json_response(resp.content, fallback={
            "platform_recommendations": [],
            "recommended_monthly_budget_usd": 0,
            "alternative_budgets": [],
            "funnel_projection": {},
            "monthly_projections": [],
            "reasoning_ar": "",
            "reasoning_en": "",
        })
        if not isinstance(data, dict):
            data = {}
        return {"ad_strategy": data}
