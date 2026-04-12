from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import parse_json_response


# Generic ElevenLabs voice IDs (public pre-made voices).
DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM"  # Rachel (en, warm)
VOICE_CATALOG = {
    "en_female_warm": "21m00Tcm4TlvDq8ikWAM",   # Rachel
    "en_female_young": "EXAVITQu4vr4xnSDxMaL",  # Bella
    "en_male_deep": "TxGEqnHWrfWFTfGW9XjX",     # Josh
    "en_male_narrator": "VR6AewLTigWG4xSOukaG", # Arnold
    "ar_male": "pNInz6obpgDQGcFmaJgB",          # Adam (multilingual, works for AR)
    "ar_female": "Xb7hH8MSUJpSbSDYk0k2",        # Alice (multilingual)
}


class VoiceSelector(BaseSubAgent):
    name = "voice_selector"
    model_tier = "fast"
    system_prompt = (
        "You pick the best ElevenLabs voice for a short video voiceover based on language, "
        "tone, and video_type. You will be given a small catalog of voice keys to choose from. "
        'Return STRICT JSON only: {"voice_key": "<one of the catalog keys>", "reason": "..."}. '
        "No prose, no markdown."
    )

    async def execute(self, state):
        language = state.get("language", "en")
        video_type = state.get("video_type", "ad")
        voice = state.get("brand_voice", {}) or {}

        user = (
            f"Language: {language}\n"
            f"Video type: {video_type}\n"
            f"Brand voice: {voice}\n\n"
            f"Catalog keys: {list(VOICE_CATALOG.keys())}\n\n"
            "Return the JSON now."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        data = parse_json_response(resp.content, fallback={"voice_key": ""})
        key = (data.get("voice_key") or "").strip()
        voice_id = VOICE_CATALOG.get(key, DEFAULT_VOICE)

        existing = state.get("meta", {}) or {}
        return {
            "voice_id": voice_id,
            "meta": {**existing, "voice_key": key or "default", "voice_reason": data.get("reason", "")},
        }
