"""StrategyAgent — generates a full strategic marketing plan from a business profile."""
from __future__ import annotations

from typing import Any

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
from app.agents.strategy.subagents.ad_strategist import AdStrategist
from app.agents.strategy.subagents.positioning_strategist import PositioningStrategist
from app.agents.strategy.subagents.customer_journey import CustomerJourney
from app.agents.strategy.subagents.offer_designer import OfferDesigner
from app.agents.strategy.subagents.funnel_architect import FunnelArchitect
from app.agents.strategy.subagents.conversion_system import ConversionSystem
from app.agents.strategy.subagents.retention_strategy import RetentionStrategy
from app.agents.strategy.subagents.growth_loops import GrowthLoops
from app.agents.strategy.subagents.execution_roadmap import ExecutionRoadmap


@register_agent
class StrategyAgent(BaseAgent):
    name = "strategy"
    system_prompt = (
        "You orchestrate a senior marketing-strategy team to produce a deep, realistic, "
        "budget-aware strategic marketing plan — not a content calendar."
    )

    def __init__(
        self,
        tenant_id: str,
        model_override: str | None = None,
        mode_config: dict[str, str] | None = None,
    ):
        super().__init__(tenant_id, model_override)
        # {node_name: model_id} — set by the service layer after loading from DB
        self._mode_config: dict[str, str] = mode_config or {}

    def build_graph(self):
        g = StateGraph(StrategyState)

        nodes = [
            ("market", MarketAnalyzer),
            ("audience", AudienceProfiler),
            ("positioning", PositioningStrategist),
            ("customer_journey", CustomerJourney),
            ("offer", OfferDesigner),
            ("funnel", FunnelArchitect),
            ("channels", ChannelPlanner),
            ("conversion", ConversionSystem),
            ("retention", RetentionStrategy),
            ("growth_loops", GrowthLoops),
            ("calendar", ContentCalendar),
            ("kpis", KPISetter),
            ("ads", AdStrategist),
            ("execution_roadmap", ExecutionRoadmap),
        ]

        mode_cfg = self._mode_config

        def _node(node_name: str, cls: Any):
            model = mode_cfg.get(node_name)

            async def _run(state: dict) -> dict:
                return await cls(state["tenant_id"], model_override=model).execute(state)

            return _run

        for node_name, cls in nodes:
            g.add_node(node_name, _node(node_name, cls))

        g.set_entry_point(nodes[0][0])
        for (a, _), (b, _) in zip(nodes, nodes[1:]):
            g.add_edge(a, b)
        g.add_edge(nodes[-1][0], END)

        return g.compile(checkpointer=get_checkpointer())
