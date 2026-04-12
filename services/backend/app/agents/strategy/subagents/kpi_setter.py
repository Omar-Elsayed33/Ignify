from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import parse_json_response, lang_directive


class KPISetter(BaseSubAgent):
    name = "kpi_setter"
    model_tier = "fast"
    system_prompt = (
        "Define 5-8 measurable KPIs (SMART) for the plan. "
        "Return JSON array of {metric, target, unit, timeframe_days, channel}. "
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
            "Return KPIs JSON array."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        kpis = parse_json_response(resp.content, fallback=[])
        if isinstance(kpis, dict):
            kpis = kpis.get("kpis", [])
        # Derive top-level goals summary
        goals = [f"{k.get('metric')}: {k.get('target')} {k.get('unit', '')}" for k in kpis if isinstance(k, dict)]
        return {"kpis": kpis, "goals": goals}
