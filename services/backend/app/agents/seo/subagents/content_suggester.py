"""ContentSuggester — proposes titles / meta / H1 / outline for a topic."""
from __future__ import annotations

import json as _json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import BaseSubAgent


class ContentSuggester(BaseSubAgent):
    name = "content_suggester"
    model_tier = "balanced"
    system_prompt = (
        "You are an SEO content strategist. Given a target topic and keywords, propose "
        'a JSON object: {"titles": [...], "meta_descriptions": [...], "h1": "...", '
        '"outline": [...section headings...], "content_topics": [...related ideas...]}. '
        "Return ONLY valid JSON."
    )

    async def execute(self, state: dict[str, Any]) -> dict[str, Any]:
        keywords = state.get("target_keywords") or []
        topic = (state.get("audit_result") or {}).get("title") or (keywords[0] if keywords else "")
        lang = state.get("language", "ar")
        user = (
            f"Language: {lang}\n"
            f"Primary topic: {topic}\n"
            f"Target keywords: {', '.join(keywords[:10])}\n\n"
            "Return the JSON object now."
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
        return {"content_suggestions": data}
