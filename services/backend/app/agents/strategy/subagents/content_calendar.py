from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import (
    parse_json_response,
    lang_directive,
    budget_context,
    constraint_directive,
)


class ContentCalendar(BaseSubAgent):
    name = "content_calendar"
    model_tier = "smart"
    system_prompt = (
        "Build a content calendar where EACH item maps to a funnel stage.\n"
        "Every item MUST include these fields:\n"
        "- stage: awareness|interest|desire|action|retention\n"
        "- objective: the specific funnel KPI this post moves\n"
        "- expected_action: what a viewer should DO after seeing this\n"
        "- cta_type: follow|dm|click|book|buy\n"
        "- day, channel, format, topic, hook, cta, kpi, hashtags[]\n"
        "Balance: 40% awareness, 20% interest, 20% desire, 15% action, 5% retention.\n"
        "Tie every item to the business offer and customer journey — no generic 'engagement posts'."
    )

    async def execute(self, state):
        bp = state.get("business_profile", {})
        channels = state.get("channels", [])
        period = state.get("period_days", 30)
        lang = state.get("language", "ar")
        offer = state.get("offer", {})
        journey = state.get("customer_journey", {})
        user = (
            lang_directive(lang) + "\n\n"
            + constraint_directive() + "\n\n"
            f"{budget_context(state)}\n\n"
            f"Period: {period} days\nBusiness: {bp}\nChannels: {channels}\n"
            f"Offer: {offer}\nJourney stages: {journey}\n\n"
            "Return the funnel-balanced calendar as a JSON array (one item per scheduled post)."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        calendar = parse_json_response(resp.content, fallback=[])
        if isinstance(calendar, dict):
            calendar = calendar.get("calendar", [])
        return {"calendar": calendar}
