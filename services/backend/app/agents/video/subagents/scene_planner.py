from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import parse_json_response


class ScenePlanner(BaseSubAgent):
    name = "scene_planner"
    model_tier = "balanced"
    system_prompt = (
        "You are a short-video storyboard director. Given a spoken voiceover script and a "
        "target total duration, break the video into 4 to 6 scenes. For each scene provide: "
        "a highly descriptive visual_prompt for a text-to-video model (concrete nouns, camera "
        "angle, lighting, color palette, mood), a short text_overlay (punchy caption shown on "
        "screen, <=8 words), and duration_seconds (integer, scenes should sum roughly to the "
        "total duration). "
        'Return STRICT JSON only: {"scenes": [{"visual_prompt": "...", "text_overlay": "...", '
        '"duration_seconds": 5}, ...]}. No prose, no markdown.'
    )

    async def execute(self, state):
        script = state.get("script", "") or ""
        duration = int(state.get("duration_seconds", 30) or 30)
        aspect = state.get("aspect_ratio", "9:16")
        video_type = state.get("video_type", "ad")
        voice = state.get("brand_voice", {}) or {}

        user = (
            f"Total duration: {duration}s\n"
            f"Aspect ratio: {aspect}\n"
            f"Video type: {video_type}\n"
            f"Brand voice: {voice}\n\n"
            f"Script:\n{script}\n\n"
            "Return the JSON now."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        data = parse_json_response(resp.content, fallback={"scenes": []})
        scenes = data.get("scenes") or []

        cleaned: list[dict] = []
        for s in scenes:
            if not isinstance(s, dict):
                continue
            cleaned.append({
                "visual_prompt": str(s.get("visual_prompt") or "").strip(),
                "text_overlay": str(s.get("text_overlay") or "").strip(),
                "duration_seconds": int(s.get("duration_seconds") or 0) or max(1, duration // max(1, len(scenes))),
            })

        if not cleaned:
            # Fallback single-scene plan
            cleaned = [{
                "visual_prompt": script[:240] or state.get("idea", ""),
                "text_overlay": "",
                "duration_seconds": duration,
            }]

        return {"scenes": cleaned}
