"""AnalyticsAgent — summarizes metrics, extracts insights, and writes recommendations."""
from __future__ import annotations

from langgraph.graph import StateGraph, END

from app.agents.analytics.state import AnalyticsState
from app.agents.analytics.subagents.insights_generator import InsightsGenerator
from app.agents.analytics.subagents.metrics_summarizer import MetricsSummarizer
from app.agents.analytics.subagents.report_writer import ReportWriter
from app.agents.base import BaseAgent
from app.agents.checkpointer import get_checkpointer
from app.agents.registry import register_agent


@register_agent
class AnalyticsAgent(BaseAgent):
    name = "analytics"
    system_prompt = (
        "You orchestrate analytics sub-agents to produce a weekly marketing "
        "performance report: a two-paragraph summary, sharp insights, and "
        "actionable recommendations — in the requested language."
    )

    def build_graph(self):
        g = StateGraph(AnalyticsState)

        async def run_summarizer(state):
            return await MetricsSummarizer(state.get("tenant_id", "")).execute(state)

        async def run_insights(state):
            return await InsightsGenerator(state.get("tenant_id", "")).execute(state)

        async def run_recommendations(state):
            return await ReportWriter(state.get("tenant_id", "")).execute(state)

        g.add_node("summarizer", run_summarizer)
        g.add_node("insights", run_insights)
        g.add_node("recommendations", run_recommendations)

        g.set_entry_point("summarizer")
        g.add_edge("summarizer", "insights")
        g.add_edge("insights", "recommendations")
        g.add_edge("recommendations", END)

        return g.compile(checkpointer=get_checkpointer())
