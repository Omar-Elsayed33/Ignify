from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import parse_json_response


class BrandGuard(BaseSubAgent):
    name = "brand_guard"
    model_tier = "fast"
    system_prompt = (
        "You are a brand compliance reviewer for visual creatives. Given an image-generation "
        "prompt and a brand_voice spec (tone, brand colors, forbidden words/topics), verify "
        "the prompt aligns with the brand (colors, mood, restrictions). You may lightly "
        "augment the prompt to better match brand colors/tone while preserving the idea. "
        'Return STRICT JSON only with keys: {"prompt": "...", "brand_check": "ok"|"warning", '
        '"notes": "..."}. No prose.'
    )

    async def execute(self, state):
        prompt = state.get("prompt", "") or ""
        voice = state.get("brand_voice", {}) or {}
        user = (
            f"Brand voice: {voice}\n\n"
            f"Prompt:\n{prompt}\n\n"
            "Return the JSON."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        data = parse_json_response(resp.content, fallback={
            "prompt": prompt,
            "brand_check": "warning",
            "notes": "auto-fallback: parser failed",
        })
        new_prompt = (data.get("prompt") or prompt).strip()
        existing = state.get("meta", {}) or {}
        merged = {
            **existing,
            "brand_check": data.get("brand_check", "ok"),
            "brand_notes": data.get("notes", ""),
        }
        return {"prompt": new_prompt, "meta": merged}
