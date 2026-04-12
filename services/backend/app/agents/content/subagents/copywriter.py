from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent


class Copywriter(BaseSubAgent):
    name = "copywriter"
    model_tier = "balanced"
    system_prompt = (
        "You are an expert marketing copywriter. Write a short, punchy social post "
        "or ad copy tailored to the target channel and brand voice. Keep it concise, "
        "scroll-stopping, and aligned with the brief. Respond in the requested language. "
        "Return ONLY the copy text — no preamble, no quotes, no markdown."
    )

    async def execute(self, state):
        brief = state.get("brief", "")
        target = state.get("target", "post")
        channel = state.get("channel", "")
        lang = state.get("language", "ar")
        voice = state.get("brand_voice", {}) or {}
        user = (
            f"Language: {lang}\n"
            f"Target format: {target}\n"
            f"Channel: {channel}\n"
            f"Brand voice: {voice}\n\n"
            f"Brief:\n{brief}\n\n"
            "Write the copy now."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        return {"draft": (resp.content or "").strip()}
