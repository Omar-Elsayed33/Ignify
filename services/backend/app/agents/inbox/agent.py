"""InboxAgent — drafts replies to inbound customer messages."""
from __future__ import annotations

from langgraph.graph import END, StateGraph

from app.agents.base import BaseAgent
from app.agents.checkpointer import get_checkpointer
from app.agents.inbox.state import InboxState
from app.agents.inbox.subagents.classifier import Classifier
from app.agents.inbox.subagents.escalator import Escalator
from app.agents.inbox.subagents.kb_retriever import KBRetriever
from app.agents.inbox.subagents.responder import Responder
from app.agents.registry import register_agent


@register_agent
class InboxAgent(BaseAgent):
    name = "inbox"
    system_prompt = (
        "You orchestrate a team of inbox sub-agents to classify incoming customer "
        "messages and draft polite, on-brand replies, escalating to a human when needed."
    )

    def build_graph(self):
        g = StateGraph(InboxState)

        async def run_classifier(state):
            return await Classifier(state["tenant_id"]).execute(state)

        async def run_kb(state):
            return await KBRetriever(state["tenant_id"]).execute(state)

        async def run_responder(state):
            return await Responder(state["tenant_id"]).execute(state)

        async def run_escalator(state):
            return await Escalator(state["tenant_id"]).execute(state)

        g.add_node("classifier", run_classifier)
        g.add_node("kb_retriever", run_kb)
        g.add_node("responder", run_responder)
        g.add_node("escalator", run_escalator)

        g.set_entry_point("classifier")
        g.add_edge("classifier", "kb_retriever")

        def route_by_intent(state: InboxState) -> str:
            if state.get("needs_human") or state.get("intent") == "spam":
                return "escalator"
            return "responder"

        g.add_conditional_edges(
            "kb_retriever",
            route_by_intent,
            {"escalator": "escalator", "responder": "responder"},
        )
        g.add_edge("responder", END)
        g.add_edge("escalator", END)

        return g.compile(checkpointer=get_checkpointer())
