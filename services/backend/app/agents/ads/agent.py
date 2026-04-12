"""AdsAgent — plans Meta Ads campaigns (audience → budget → creative → optimizer)."""
from __future__ import annotations

from langgraph.graph import END, StateGraph

from app.agents.ads.state import AdsState
from app.agents.ads.subagents.audience_builder import AudienceBuilder
from app.agents.ads.subagents.budget_planner import BudgetPlanner
from app.agents.ads.subagents.creative_matcher import CreativeMatcher
from app.agents.ads.subagents.optimizer import Optimizer
from app.agents.base import BaseAgent
from app.agents.checkpointer import get_checkpointer
from app.agents.registry import register_agent


@register_agent
class AdsAgent(BaseAgent):
    name = "ads"
    system_prompt = (
        "You orchestrate a team of sub-agents to plan high-performing Meta Ads "
        "campaigns: audience builder → budget planner → creative matcher → optimizer."
    )

    def build_graph(self):
        g = StateGraph(AdsState)

        async def run_audience(state):
            return await AudienceBuilder(state["tenant_id"]).execute(state)

        async def run_budget(state):
            return await BudgetPlanner(state["tenant_id"]).execute(state)

        async def run_creative(state):
            return await CreativeMatcher(state["tenant_id"]).execute(state)

        async def run_optimizer(state):
            return await Optimizer(state["tenant_id"]).execute(state)

        g.add_node("audience", run_audience)
        g.add_node("budget", run_budget)
        g.add_node("creative", run_creative)
        g.add_node("optimizer", run_optimizer)

        g.set_entry_point("audience")
        g.add_edge("audience", "budget")
        g.add_edge("budget", "creative")
        g.add_edge("creative", "optimizer")
        g.add_edge("optimizer", END)

        return g.compile(checkpointer=get_checkpointer())
