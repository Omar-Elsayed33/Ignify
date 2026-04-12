"""ContentAgent — generates marketing copy (post / blog / caption / ad_copy)."""
from __future__ import annotations

from langgraph.graph import StateGraph, END

from app.agents.base import BaseAgent
from app.agents.checkpointer import get_checkpointer
from app.agents.registry import register_agent
from app.agents.content.state import ContentState
from app.agents.content.subagents.blogger import Blogger
from app.agents.content.subagents.brand_guard import BrandGuard
from app.agents.content.subagents.caption_writer import CaptionWriter
from app.agents.content.subagents.copywriter import Copywriter
from app.agents.content.subagents.translator import Translator


@register_agent
class ContentAgent(BaseAgent):
    name = "content"
    system_prompt = (
        "You orchestrate a team of content sub-agents to produce on-brand marketing "
        "copy (social posts, blog articles, captions, ad copy) in the requested language."
    )

    def build_graph(self):
        g = StateGraph(ContentState)

        async def run_copywriter(state):
            return await Copywriter(state["tenant_id"]).execute(state)

        async def run_blogger(state):
            return await Blogger(state["tenant_id"]).execute(state)

        async def run_caption(state):
            return await CaptionWriter(state["tenant_id"]).execute(state)

        async def run_brand_guard(state):
            return await BrandGuard(state["tenant_id"]).execute(state)

        async def run_translator(state):
            return await Translator(state["tenant_id"]).execute(state)

        g.add_node("copywriter", run_copywriter)
        g.add_node("blogger", run_blogger)
        g.add_node("caption_writer", run_caption)
        g.add_node("brand_guard", run_brand_guard)
        g.add_node("translator", run_translator)

        def route_entry(state: ContentState) -> str:
            target = (state.get("target") or "post").lower()
            if target == "blog":
                return "blogger"
            if target == "caption":
                return "caption_writer"
            return "copywriter"

        g.set_conditional_entry_point(
            route_entry,
            {
                "blogger": "blogger",
                "caption_writer": "caption_writer",
                "copywriter": "copywriter",
            },
        )

        g.add_edge("copywriter", "brand_guard")
        g.add_edge("blogger", "brand_guard")
        g.add_edge("caption_writer", "brand_guard")
        g.add_edge("brand_guard", "translator")
        g.add_edge("translator", END)

        return g.compile(checkpointer=get_checkpointer())
