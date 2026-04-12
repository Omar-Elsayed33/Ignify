from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import parse_json_response


class BrandGuard(BaseSubAgent):
    name = "brand_guard"
    model_tier = "fast"
    system_prompt = (
        "You are a brand compliance reviewer. Given a draft of marketing copy and a "
        "brand_voice spec (tone, style, forbidden_words), verify the draft matches the "
        "tone and contains NO forbidden words. If needed, lightly edit the text to fix "
        "issues while preserving meaning. "
        "Return STRICT JSON only with keys: final (cleaned text), brand_check "
        "('ok' if fully compliant, 'warning' if you had to edit or concerns remain), "
        "notes (short string explaining any changes or concerns)."
    )

    async def execute(self, state):
        draft = state.get("draft", "") or ""
        voice = state.get("brand_voice", {}) or {}
        lang = state.get("language", "ar")
        user = (
            f"Language: {lang}\n"
            f"Brand voice: {voice}\n\n"
            f"Draft:\n{draft}\n\n"
            "Return the JSON."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        data = parse_json_response(resp.content, fallback={
            "final": draft, "brand_check": "warning", "notes": "auto-fallback: parser failed"
        })
        final = data.get("final") or draft
        existing_meta = state.get("meta", {}) or {}
        merged_meta = {
            **existing_meta,
            "brand_check": data.get("brand_check", "ok"),
            "notes": data.get("notes", ""),
        }
        return {"final": final, "meta": merged_meta}
