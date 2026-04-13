from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import (
    parse_json_response,
    lang_directive,
    budget_context,
    constraint_directive,
)


class OfferDesigner(BaseSubAgent):
    name = "offer_designer"
    model_tier = "smart"
    system_prompt = (
        "Design the 'why buy NOW' offer.\n"
        "Return STRICT JSON: {core_offer{name,includes[],price_usd,anchor_price_usd}, "
        "urgency_mechanism ('limited stock'|'time-limited'|'seasonal'|'cohort'), "
        "risk_reversal (guarantee|trial|refund policy), bonuses[{bonus,perceived_value_usd,"
        "real_cost_usd}], irresistible_reason (ONE sentence why a stranger would stop scrolling "
        "and buy), offer_deliverability (honest check: can they fulfill this at scale?)}.\n"
        "No generic 'great value'. Every element must create urgency or reduce risk.\n"
        "\nALSO include tiered pricing and upsell/cross-sell matrix:\n"
        "- `pricing_tiers`: [\n"
        "   {name: 'basic', price_usd: N, includes: [...], target_segment: 'price-sensitive'},\n"
        "   {name: 'pro', price_usd: N*2, includes: [...], target_segment: 'main', marked_as_popular: true},\n"
        "   {name: 'premium', price_usd: N*4, includes: [...], target_segment: 'enterprise'}]\n"
        "- `upsell_matrix`: [{from_tier, to_tier, trigger, expected_upsell_rate_pct}]\n"
        "- `cross_sell_products`: [{product, attach_rate_pct, avg_order_increase_usd}]"
    )

    async def execute(self, state):
        bp = state.get("business_profile", {})
        lang = state.get("language", "ar")
        personas = state.get("personas", [])
        positioning = state.get("positioning", {})
        market = state.get("market_analysis", {})
        user = (
            lang_directive(lang) + "\n\n"
            + constraint_directive() + "\n\n"
            f"{budget_context(state)}\n\n"
            f"Business: {bp}\nPersonas: {personas}\nPositioning: {positioning}\n"
            f"Competitor pricing: {[c.get('pricing') for c in market.get('competitors', []) if isinstance(c, dict)]}\n\n"
            "Return the offer design JSON."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        data = parse_json_response(resp.content, fallback={})
        if not isinstance(data, dict):
            data = {}
        return {"offer": data}
