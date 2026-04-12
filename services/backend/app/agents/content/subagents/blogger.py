from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import parse_json_response


class Blogger(BaseSubAgent):
    name = "blogger"
    model_tier = "smart"
    system_prompt = (
        "You are a senior SEO-savvy blog writer. Produce a well-structured, engaging "
        "long-form blog article (600-1200 words) with clear headings (H2/H3), "
        "an introduction, a strong conclusion, and a catchy SEO title. "
        "Match the brand voice and requested language. "
        "Return STRICT JSON only with keys: title (string), body (markdown string)."
    )

    async def execute(self, state):
        brief = state.get("brief", "")
        lang = state.get("language", "ar")
        voice = state.get("brand_voice", {}) or {}
        channel = state.get("channel", "blog")
        user = (
            f"Language: {lang}\n"
            f"Channel: {channel}\n"
            f"Brand voice: {voice}\n\n"
            f"Brief:\n{brief}\n\n"
            "Produce the blog article JSON."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        data = parse_json_response(resp.content, fallback={"title": "", "body": resp.content or ""})
        return {
            "draft": data.get("body", "") or "",
            "title": data.get("title", "") or "",
        }
