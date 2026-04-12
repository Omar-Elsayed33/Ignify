"""ContentAnalyzer — extracts themes / tone / content types from scraped pages."""
from __future__ import annotations

import json as _json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import BaseSubAgent


class ContentAnalyzer(BaseSubAgent):
    name = "competitor_content_analyzer"
    model_tier = "balanced"
    system_prompt = (
        "You analyse a competitor's public web content. Given scraped metadata "
        "(titles, headings, OG, blog links), return a JSON object: "
        '{"themes": [...], "content_types": [...], "tone": "...", '
        '"positioning": "...", "summary": "..."}. Return ONLY valid JSON.'
    )

    async def execute(self, state: dict[str, Any]) -> dict[str, Any]:
        scraped = state.get("scraped") or []
        lang = state.get("language", "ar")
        name = state.get("name", "competitor")
        # Keep payload compact
        compact = []
        for s in scraped[:10]:
            compact.append(
                {
                    "url": s.get("url"),
                    "title": s.get("title"),
                    "og_title": s.get("og_title"),
                    "og_description": s.get("og_description"),
                    "headings": (s.get("headings") or [])[:10],
                    "blog_links": [b.get("text") for b in (s.get("blog_links") or [])[:5]],
                }
            )
        user = (
            f"Language: {lang}\nCompetitor: {name}\n"
            f"Scraped pages:\n{_json.dumps(compact, ensure_ascii=False)[:4000]}\n\n"
            "Return the JSON analysis."
        )
        try:
            resp = await self.llm.ainvoke(
                [SystemMessage(content=self.system_prompt), HumanMessage(content=user)]
            )
            text = (resp.content or "").strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                text = text.rsplit("```", 1)[0]
            data = _json.loads(text)
            if not isinstance(data, dict):
                data = {}
        except Exception:  # noqa: BLE001
            data = {}
        return {"analysis": data}
