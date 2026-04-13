from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import (
    parse_json_response,
    lang_directive,
    budget_context,
)


class MarketAnalyzer(BaseSubAgent):
    name = "market_analyzer"
    model_tier = "smart"
    system_prompt = (
        "You are a McKinsey-level senior marketing strategist. Think step-by-step, WRITE your "
        "reasoning, THEN output JSON.\n"
        "1. Define the SPECIFIC sub-market (not 'e-commerce' — e.g. 'premium handmade leather "
        "accessories for MENA professionals 25-45').\n"
        "2. Estimate realistic TAM/SAM/SOM in USD with rationale.\n"
        "3. Name TOP 3 real competitors (name + URL) with pricing, positioning, visible weakness, "
        "estimated monthly traffic.\n"
        "4. Identify 3 under-served segments competitors ignore.\n"
        "5. List 3 trends over the next 12 months with their impact and suggested action.\n"
        "Return STRICT JSON only with keys: reasoning, micro_market, market_size{tam_usd,sam_usd,"
        "som_usd,rationale}, competitors[{name,url,pricing,positioning,weakness_to_exploit,"
        "monthly_traffic_est}], underserved_segments[], trends[{trend,impact,action}], "
        "swot{strengths[],weaknesses[],opportunities[],threats[]}.\n"
        "BANNED phrases: 'brand awareness', 'high-quality content', 'engagement'. Those are "
        "placeholders, not strategy. Every claim must reference THIS business + budget."
    )

    async def execute(self, state):
        bp = state.get("business_profile", {})
        lang = state.get("language", "ar")
        user = (
            lang_directive(lang) + "\n\n"
            f"{budget_context(state)}\n\n"
            f"Business profile:\n{bp}\n\n"
            "Produce the deep market analysis JSON."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        data = parse_json_response(resp.content, fallback={
            "reasoning": "", "micro_market": "", "market_size": {},
            "competitors": [], "underserved_segments": [], "trends": [], "swot": {},
        })
        if not isinstance(data, dict):
            data = {}
        # Back-compat: keep legacy "summary" key so existing UI still renders
        if "summary" not in data and data.get("micro_market"):
            data["summary"] = data["micro_market"]
        return {"market_analysis": data}
