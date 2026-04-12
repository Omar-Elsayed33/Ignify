"""SEOAgent — orchestrates on-page audit + rank check + content/link suggestions."""
from __future__ import annotations

from langgraph.graph import END, StateGraph

from app.agents.base import BaseAgent
from app.agents.checkpointer import get_checkpointer
from app.agents.registry import register_agent
from app.agents.seo.state import SEOState
from app.agents.seo.subagents.audit_analyzer import AuditAnalyzer
from app.agents.seo.subagents.content_suggester import ContentSuggester
from app.agents.seo.subagents.linking_strategist import LinkingStrategist
from app.core.seo import find_ranking
from app.core.seo_audit import audit_url


@register_agent
class SEOAgent(BaseAgent):
    name = "seo"
    system_prompt = (
        "You coordinate SEO sub-agents to produce an actionable, prioritised SEO report: "
        "on-page audit, keyword rankings, content suggestions, internal linking strategy."
    )

    def build_graph(self):
        g = StateGraph(SEOState)

        async def do_audit(state):
            url = state.get("url") or ""
            result = await audit_url(url) if url else {}
            return {"audit_result": result}

        async def do_rank_check(state):
            url = state.get("url") or ""
            # Infer target domain from url
            domain = url.replace("https://", "").replace("http://", "").split("/")[0]
            keywords = state.get("target_keywords") or []
            lang = state.get("language", "ar")
            rankings: list[dict] = []
            for kw in keywords[:20]:
                try:
                    r = await find_ranking(kw, domain, hl=lang)
                    rankings.append({"keyword": kw, **r})
                except Exception:  # noqa: BLE001
                    rankings.append({"keyword": kw, "position": None})
            return {"rankings": rankings}

        async def run_analyzer(state):
            return await AuditAnalyzer(state["tenant_id"]).execute(state)

        async def run_content(state):
            return await ContentSuggester(state["tenant_id"]).execute(state)

        async def run_links(state):
            return await LinkingStrategist(state["tenant_id"]).execute(state)

        g.add_node("audit", do_audit)
        g.add_node("rank_check", do_rank_check)
        g.add_node("analyze", run_analyzer)
        g.add_node("suggest_content", run_content)
        g.add_node("link_strategy", run_links)

        g.set_entry_point("audit")
        g.add_edge("audit", "rank_check")
        g.add_edge("rank_check", "analyze")
        g.add_edge("analyze", "suggest_content")
        g.add_edge("suggest_content", "link_strategy")
        g.add_edge("link_strategy", END)

        return g.compile(checkpointer=get_checkpointer())
