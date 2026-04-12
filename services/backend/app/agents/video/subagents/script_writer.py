from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent


class ScriptWriter(BaseSubAgent):
    name = "script_writer"
    model_tier = "balanced"
    system_prompt = (
        "You are a short-form video scriptwriter for social media (TikTok, Reels, YouTube Shorts). "
        "Write a concise spoken voiceover script for the requested duration. Aim for roughly "
        "3-5 sentences per 15 seconds of video. Match the requested language and tone dictated "
        "by the brand_voice and video_type. Avoid stage directions or scene labels — output ONLY "
        "the spoken voiceover lines as plain text, ready to be read aloud."
    )

    async def execute(self, state):
        idea = state.get("idea", "") or ""
        duration = int(state.get("duration_seconds", 30) or 30)
        language = state.get("language", "en")
        video_type = state.get("video_type", "ad")
        voice = state.get("brand_voice", {}) or {}

        target_sentences = max(3, int(round((duration / 15) * 4)))

        user = (
            f"Language: {language}\n"
            f"Duration: {duration}s\n"
            f"Video type: {video_type}\n"
            f"Target length: approx {target_sentences} short sentences.\n"
            f"Brand voice: {voice}\n\n"
            f"Idea:\n{idea}\n\n"
            "Write the voiceover script now."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        script = (resp.content or "").strip()
        if not script:
            script = idea
        return {"script": script}
