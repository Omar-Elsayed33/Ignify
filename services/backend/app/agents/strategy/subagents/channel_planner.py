from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import (
    parse_json_response,
    lang_directive,
    budget_context,
    constraint_directive,
)


class ChannelPlanner(BaseSubAgent):
    name = "channel_planner"
    model_tier = "smart"
    system_prompt = (
        "Don't list channels. Design an ACQUISITION STRATEGY. Think step-by-step:\n"
        "1. Given the budget, which 2-3 channels deliver the best CAC?\n"
        "2. What is the SPECIFIC tactic per channel? (e.g. not 'post on Instagram' — 'daily Reels "
        "showing workshop craftsmanship, link in bio to WhatsApp catalog').\n"
        "3. Realistic CPL per channel for MENA/target region?\n"
        "4. How much can the business spend before saturation on each?\n"
        "5. Organic vs paid split given the budget.\n"
        "Return STRICT JSON: {reasoning, channels[{channel, tactic, budget_allocation_usd, "
        "expected_cpl_usd, expected_leads_month, organic_vs_paid (e.g. '30/70'), rationale}], "
        "total_budget_check (must sum to user's budget), channels_to_avoid[{channel, why}]}.\n"
        "HARD RULE: sum of budget_allocation_usd MUST equal the user's monthly budget. "
        "If budget is 0, all allocations are 0 and organic_vs_paid is '100/0'.\n"
        "\nClassify each channel by intent:\n"
        "- `intent: \"high_intent\" | \"passive_discovery\" | \"warm_referral\"`\n"
        "- For each channel, also include: conversion_rate_to_customer_pct, "
        "why_this_channel_for_this_intent.\n"
        "Include at least 1 channel per intent bucket. If budget < $300, drop \"high_intent\" "
        "(Google Ads) and go passive+warm only."
    )

    async def execute(self, state):
        bp = state.get("business_profile", {})
        personas = state.get("personas", [])
        lang = state.get("language", "ar")
        user = (
            lang_directive(lang) + "\n\n"
            + constraint_directive() + "\n\n"
            f"{budget_context(state)}\n\n"
            f"Business: {bp}\nPersonas: {personas}\n\n"
            "Return the acquisition strategy JSON. Sum of channel budgets MUST equal user's monthly budget."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        data = parse_json_response(resp.content, fallback={"reasoning": "", "channels": [], "channels_to_avoid": []})
        if isinstance(data, list):
            data = {"channels": data}
        channels = data.get("channels", []) if isinstance(data, dict) else []
        return {"channels": channels}
