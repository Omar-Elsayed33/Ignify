from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import (
    parse_json_response,
    lang_directive,
    budget_context,
)


class ExecutionRoadmap(BaseSubAgent):
    name = "execution_roadmap"
    model_tier = "balanced"
    system_prompt = (
        "Build a 30-day day-by-day RESULTS-focused action roadmap (not posting-focused).\n"
        "Each day has ONE priority action (not 5).\n"
        " - Week 1 = setup (tracking, landing page, ad account, WA catalog).\n"
        " - Week 2 = launch (first campaign live, first content batch).\n"
        " - Week 3 = optimize (kill losers, double down on winners).\n"
        " - Week 4 = scale + systemize.\n"
        "Return STRICT JSON ARRAY of exactly 30 items: "
        "{day, priority_action, owner_role, expected_outcome, blocker_to_watch}."
    )

    async def execute(self, state):
        bp = state.get("business_profile", {})
        lang = state.get("language", "ar")
        channels = state.get("channels", [])
        offer = state.get("offer", {})
        conversion = state.get("conversion", {})
        user = (
            lang_directive(lang) + "\n\n"
            f"{budget_context(state)}\n\n"
            f"Business: {bp}\nChannels: {channels}\nOffer: {offer}\nConversion: {conversion}\n\n"
            "Return a JSON array of 30 day items."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        data = parse_json_response(resp.content, fallback=[])
        if isinstance(data, dict):
            data = data.get("roadmap") or data.get("days") or []
        if not isinstance(data, list):
            data = []
        return {"execution_roadmap": data}
