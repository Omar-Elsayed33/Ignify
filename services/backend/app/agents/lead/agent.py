"""LeadAgent — qualifies leads using a fast LLM pipeline."""
from __future__ import annotations

from langgraph.graph import END, StateGraph

from app.agents.base import BaseAgent
from app.agents.checkpointer import get_checkpointer
from app.agents.lead.state import LeadState
from app.agents.lead.subagents.qualifier import LeadQualifier
from app.agents.registry import register_agent


@register_agent
class LeadAgent(BaseAgent):
    name = "lead"
    system_prompt = (
        "You orchestrate lead qualification sub-agents to score and advise on "
        "marketing/sales leads for the Ignify CRM."
    )

    def build_graph(self):
        g = StateGraph(LeadState)

        async def run_qualifier(state):
            return await LeadQualifier(state["tenant_id"]).execute(state)

        g.add_node("qualifier", run_qualifier)
        g.set_entry_point("qualifier")
        g.add_edge("qualifier", END)

        return g.compile(checkpointer=get_checkpointer())
