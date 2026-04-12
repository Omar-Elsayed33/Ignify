"""CreativeAgent — generates AI images via Replicate (flux-schnell)."""
from __future__ import annotations

from langgraph.graph import StateGraph, END

from app.agents.base import BaseAgent
from app.agents.checkpointer import get_checkpointer
from app.agents.registry import register_agent
from app.agents.creative.state import CreativeState
from app.agents.creative.subagents.prompt_engineer import PromptEngineer
from app.agents.creative.subagents.brand_guard import BrandGuard
from app.agents.creative.subagents.image_generator import run_image_generator


@register_agent
class CreativeAgent(BaseAgent):
    name = "creative"
    system_prompt = (
        "You orchestrate a team of creative sub-agents to generate on-brand marketing "
        "imagery from a short user idea."
    )

    def build_graph(self):
        g = StateGraph(CreativeState)

        async def run_prompt_engineer(state):
            return await PromptEngineer(state["tenant_id"]).execute(state)

        async def run_brand_guard(state):
            return await BrandGuard(state["tenant_id"]).execute(state)

        async def run_generator(state):
            return await run_image_generator(state)

        g.add_node("prompt_engineer", run_prompt_engineer)
        g.add_node("brand_guard", run_brand_guard)
        g.add_node("image_generator", run_generator)

        g.set_entry_point("prompt_engineer")
        g.add_edge("prompt_engineer", "brand_guard")
        g.add_edge("brand_guard", "image_generator")
        g.add_edge("image_generator", END)

        return g.compile(checkpointer=get_checkpointer())
