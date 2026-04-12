from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import parse_json_response, lang_directive


class ContentCalendar(BaseSubAgent):
    name = "content_calendar"
    model_tier = "smart"
    system_prompt = (
        "Create a content calendar for the requested period. "
        "Return JSON array of items: {day, channel, format, topic, hook, cta, hashtags[]}. "
        "Distribute across recommended channels; balance education, entertainment, promotion. "
        "Match the user's requested language exactly."
    )

    async def execute(self, state):
        bp = state.get("business_profile", {})
        channels = state.get("channels", [])
        period = state.get("period_days", 30)
        lang = state.get("language", "ar")
        user = (
            lang_directive(lang) + "\n\n"
            f"Language: {lang}\nPeriod: {period} days\n"
            f"Business: {bp}\nChannels: {channels}\n\n"
            "Return calendar JSON array (one item per scheduled post)."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        calendar = parse_json_response(resp.content, fallback=[])
        if isinstance(calendar, dict):
            calendar = calendar.get("calendar", [])
        return {"calendar": calendar}
