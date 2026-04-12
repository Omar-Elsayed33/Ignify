"""CompetitorAgent — scrape public pages, analyse content, find gaps."""
from __future__ import annotations

from langgraph.graph import END, StateGraph

from app.agents.base import BaseAgent
from app.agents.checkpointer import get_checkpointer
from app.agents.competitor.state import CompetitorState
from app.agents.competitor.subagents.content_analyzer import ContentAnalyzer
from app.agents.competitor.subagents.gap_finder import GapFinder
from app.agents.registry import register_agent
from app.core.competitor_scraper import scrape_public_page


@register_agent
class CompetitorAgent(BaseAgent):
    name = "competitor"
    system_prompt = (
        "You coordinate competitor-intelligence sub-agents: scrape public metadata, "
        "analyse content themes, then surface actionable gaps vs our brand."
    )

    def build_graph(self):
        g = StateGraph(CompetitorState)

        async def do_scrape(state):
            urls = state.get("urls") or []
            scraped = []
            for u in urls[:10]:
                if not u:
                    continue
                scraped.append(await scrape_public_page(u))
            return {"scraped": scraped}

        async def run_analyzer(state):
            return await ContentAnalyzer(state["tenant_id"]).execute(state)

        async def run_gaps(state):
            return await GapFinder(state["tenant_id"]).execute(state)

        g.add_node("scrape", do_scrape)
        g.add_node("analyze", run_analyzer)
        g.add_node("gaps", run_gaps)

        g.set_entry_point("scrape")
        g.add_edge("scrape", "analyze")
        g.add_edge("analyze", "gaps")
        g.add_edge("gaps", END)

        return g.compile(checkpointer=get_checkpointer())
