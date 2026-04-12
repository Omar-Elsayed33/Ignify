"""AuditAnalyzer — turns a raw on-page audit into prioritised recommendations."""
from __future__ import annotations

import json as _json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import BaseSubAgent


class AuditAnalyzer(BaseSubAgent):
    name = "audit_analyzer"
    model_tier = "balanced"
    system_prompt = (
        "You are an SEO auditor. Given a raw on-page audit JSON, produce a JSON array of "
        "prioritised recommendations. Each item: "
        '{"priority": "high|medium|low", "category": "technical|content|on-page|performance", '
        '"title": "...", "description": "...", "impact": "..."}. '
        "Return ONLY a JSON array — no markdown, no preamble."
    )

    async def execute(self, state: dict[str, Any]) -> dict[str, Any]:
        audit = state.get("audit_result") or {}
        lang = state.get("language", "ar")
        user = (
            f"Language for recommendations: {lang}\n"
            f"Raw audit data:\n{_json.dumps(audit, ensure_ascii=False)[:4000]}\n\n"
            "Return 5–10 prioritised recommendations as a JSON array."
        )
        try:
            resp = await self.llm.ainvoke(
                [SystemMessage(content=self.system_prompt), HumanMessage(content=user)]
            )
            text = (resp.content or "").strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                text = text.rsplit("```", 1)[0]
            recs = _json.loads(text)
            if not isinstance(recs, list):
                recs = []
        except Exception:  # noqa: BLE001
            recs = []
        return {"recommendations": recs}
