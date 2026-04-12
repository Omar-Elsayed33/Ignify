from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import parse_json_response


class CaptionWriter(BaseSubAgent):
    name = "caption_writer"
    model_tier = "fast"
    system_prompt = (
        "You are a viral social-media caption writer for Instagram and TikTok. "
        "Write a short, catchy caption (1-3 sentences) with 1-2 emojis and a soft CTA. "
        "Also produce 5-10 relevant hashtags. Match the brand voice and requested language. "
        "Return STRICT JSON only with keys: caption (string), hashtags (array of strings, "
        "each starting with #)."
    )

    async def execute(self, state):
        brief = state.get("brief", "")
        lang = state.get("language", "ar")
        voice = state.get("brand_voice", {}) or {}
        channel = state.get("channel", "instagram")
        user = (
            f"Language: {lang}\n"
            f"Channel: {channel}\n"
            f"Brand voice: {voice}\n\n"
            f"Brief:\n{brief}\n\n"
            "Produce the caption JSON."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        data = parse_json_response(resp.content, fallback={"caption": resp.content or "", "hashtags": []})
        tags = data.get("hashtags", []) or []
        # normalize to strings with leading #
        hashtags = []
        for t in tags:
            if not isinstance(t, str):
                continue
            t = t.strip()
            if not t:
                continue
            if not t.startswith("#"):
                t = "#" + t.lstrip("#")
            hashtags.append(t)
        return {
            "draft": data.get("caption", "") or "",
            "hashtags": hashtags,
        }
