from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import parse_json_response


class ChannelPlanner(BaseSubAgent):
    name = "channel_planner"
    model_tier = "balanced"
    system_prompt = (
        "Pick the top 3-5 marketing channels (Instagram, TikTok, FB, Google, WhatsApp, SEO, Email) "
        "ranked by fit for this business and audience. "
        "Return JSON array of {channel, priority, rationale, posting_frequency_per_week, budget_share_pct}."
    )

    async def execute(self, state):
        bp = state.get("business_profile", {})
        personas = state.get("personas", [])
        lang = state.get("language", "ar")
        user = f"Language: {lang}\nBusiness: {bp}\nPersonas: {personas}\n\nReturn channel plan JSON."
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        channels = parse_json_response(resp.content, fallback=[])
        if isinstance(channels, dict):
            channels = channels.get("channels", [])
        return {"channels": channels}
