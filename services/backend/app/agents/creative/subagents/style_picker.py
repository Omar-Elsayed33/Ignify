from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import parse_json_response


class StylePicker(BaseSubAgent):
    name = "style_picker"
    model_tier = "fast"
    system_prompt = (
        "You are a visual art director. Given a creative idea and a chosen style "
        "(photo|illustration|3d|minimal|anime), enrich it with concrete style notes: "
        "lighting, color palette, composition, rendering technique. "
        'Return STRICT JSON only with key: {"style_notes": "..."}. No prose.'
    )

    async def execute(self, state):
        idea = state.get("idea", "") or ""
        style = state.get("style", "photo") or "photo"
        user = (
            f"Style: {style}\n"
            f"Idea:\n{idea}\n\n"
            "Return the JSON."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        data = parse_json_response(resp.content, fallback={"style_notes": ""})
        existing = state.get("meta", {}) or {}
        return {"meta": {**existing, "style_notes": data.get("style_notes", "")}}
