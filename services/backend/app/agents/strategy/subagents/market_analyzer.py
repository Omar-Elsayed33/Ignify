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
        "You are a McKinsey-level senior marketing strategist with deep knowledge of MENA markets. "
        "Think step-by-step, WRITE your reasoning, THEN output JSON.\n\n"
        "Your analysis MUST cover:\n"
        "1. Define the SPECIFIC micro-market (e.g. 'integrated labor outsourcing for construction "
        "companies in Saudi Arabia' — never generic like 'HR services').\n"
        "2. Estimate realistic TAM/SAM/SOM in USD with rationale tied to actual market data.\n"
        "3. Name the TOP 10 real competitors ranked by market dominance (largest first). "
        "For each: name, url, pricing_model, positioning (their actual market claim), "
        "weakness_to_exploit (specific gap this business can fill), monthly_traffic_est, "
        "threat_level ('high'|'medium'|'low'), digital_strength_score (1-10).\n"
        "4. Identify 3 under-served segments these competitors ALL ignore.\n"
        "5. Identify the COMPETITIVE GAP — what this business offers that NO competitor does "
        "(the unique combination that creates defensible advantage).\n"
        "6. List 5 quick-win opportunities based on competitor weaknesses.\n"
        "7. List 3 market trends over next 12 months with impact + specific action.\n"
        "8. Full SWOT with 5+ points per quadrant.\n\n"
        "Return STRICT JSON with keys:\n"
        "reasoning, micro_market, market_size{tam_usd,sam_usd,som_usd,rationale},\n"
        "competitors[{name,url,pricing_model,positioning,weakness_to_exploit,monthly_traffic_est,"
        "threat_level,digital_strength_score}],\n"
        "competitive_gap (string — the unique advantage this business has vs ALL competitors),\n"
        "underserved_segments[],\n"
        "quick_wins[{opportunity,why_competitors_miss_it,action,expected_impact}],\n"
        "trends[{trend,impact,action}],\n"
        "swot{strengths[],weaknesses[],opportunities[],threats[]}.\n\n"
        "BANNED phrases: 'brand awareness', 'high-quality content', 'engagement' without numbers. "
        "Every claim must reference THIS specific business + budget + market."
    )

    async def execute(self, state):
        bp = state.get("business_profile", {})
        lang = state.get("language", "ar")
        # Pass any pre-discovered competitors from website analysis
        known_competitors = bp.get("probable_competitors") or [] if isinstance(bp, dict) else []
        comp_hint = ""
        if known_competitors:
            comp_hint = (
                f"\nPre-identified competitors from website analysis (use as starting point, "
                f"expand to top 10): {known_competitors}\n"
            )
        user = (
            lang_directive(lang) + "\n\n"
            f"{budget_context(state)}\n\n"
            f"Business profile:\n{bp}\n"
            + comp_hint +
            "\nProduce the full market analysis JSON with all 10 competitors and competitive gap."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        data = parse_json_response(resp.content, fallback={
            "reasoning": "", "micro_market": "", "market_size": {},
            "competitors": [], "competitive_gap": "", "underserved_segments": [],
            "quick_wins": [], "trends": [], "swot": {},
        })
        if not isinstance(data, dict):
            data = {}
        # Back-compat: keep legacy "summary" key so existing UI still renders
        if "summary" not in data and data.get("micro_market"):
            data["summary"] = data["micro_market"]
        return {"market_analysis": data}
