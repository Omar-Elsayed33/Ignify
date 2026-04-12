"""StrategyAgent — generates a full marketing plan from a business profile."""
from __future__ import annotations

from langgraph.graph import StateGraph, END

from app.agents.base import BaseAgent
from app.agents.checkpointer import get_checkpointer
from app.agents.registry import register_agent
from app.agents.strategy.state import StrategyState
from app.agents.strategy.subagents.audience_profiler import AudienceProfiler
from app.agents.strategy.subagents.channel_planner import ChannelPlanner
from app.agents.strategy.subagents.content_calendar import ContentCalendar
from app.agents.strategy.subagents.kpi_setter import KPISetter
from app.agents.strategy.subagents.market_analyzer import MarketAnalyzer


@register_agent
class StrategyAgent(BaseAgent):
    name = "strategy"
    system_prompt = (
        "You orchestrate a team of marketing sub-agents to produce a complete, "
        "actionable marketing plan tailored to the tenant's business and language."
    )

    def build_graph(self):
        g = StateGraph(StrategyState)

        async def run_market(state):
            return await MarketAnalyzer(state["tenant_id"]).execute(state)

        async def run_audience(state):
            return await AudienceProfiler(state["tenant_id"]).execute(state)

        async def run_channels(state):
            return await ChannelPlanner(state["tenant_id"]).execute(state)

        async def run_calendar(state):
            return await ContentCalendar(state["tenant_id"]).execute(state)

        async def run_kpis(state):
            return await KPISetter(state["tenant_id"]).execute(state)

        g.add_node("market", run_market)
        g.add_node("audience", run_audience)
        g.add_node("channels", run_channels)
        g.add_node("calendar", run_calendar)
        g.add_node("kpis", run_kpis)

        g.set_entry_point("market")
        g.add_edge("market", "audience")
        g.add_edge("audience", "channels")
        g.add_edge("channels", "calendar")
        g.add_edge("calendar", "kpis")
        g.add_edge("kpis", END)

        return g.compile(checkpointer=get_checkpointer())
