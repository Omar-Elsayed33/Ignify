from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import parse_json_response


class PromptEngineer(BaseSubAgent):
    name = "prompt_engineer"
    model_tier = "balanced"
    system_prompt = (
        "You are an expert image-generation prompt engineer. Given a user idea, a desired style, "
        "target dimensions, and a brand_voice spec, craft a professional, vivid, highly descriptive "
        "prompt suitable for a text-to-image model (e.g., Flux / SDXL). Favor concrete nouns, "
        "composition, lighting, camera angle, lens, color palette, and mood. Avoid text-in-image "
        "unless requested. Also produce a succinct negative prompt to avoid common artifacts "
        "(blurry, low quality, watermark, extra limbs, distorted faces, text, logo). "
        'Return STRICT JSON only with keys: {"prompt": "...", "negative_prompt": "..."}. No prose.'
    )

    async def execute(self, state):
        idea = state.get("idea", "") or ""
        style = state.get("style", "photo") or "photo"
        dims = state.get("dimensions", "1:1") or "1:1"
        voice = state.get("brand_voice", {}) or {}
        lang = state.get("language", "en")
        user = (
            f"Language: {lang}\n"
            f"Style: {style}\n"
            f"Aspect ratio: {dims}\n"
            f"Brand voice: {voice}\n\n"
            f"Idea:\n{idea}\n\n"
            "Return the JSON now."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        data = parse_json_response(resp.content, fallback={
            "prompt": idea,
            "negative_prompt": "blurry, low quality, watermark, text, distorted",
        })
        prompt = (data.get("prompt") or idea).strip()
        negative = (data.get("negative_prompt") or "blurry, low quality, watermark").strip()
        return {"prompt": prompt, "negative_prompt": negative}
