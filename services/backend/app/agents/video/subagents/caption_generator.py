"""CaptionGenerator — produces subtitle URL for the rendered video.

TODO: integrate Whisper (openai-whisper or faster-whisper / ElevenLabs STT) to
transcribe `voice_url` and emit a hosted .srt/.vtt file. For now this is a stub.
"""
from __future__ import annotations

from typing import Any


async def run_caption_generator(state) -> dict[str, Any]:
    existing = state.get("meta", {}) or {}
    # TODO: Whisper transcription on state["voice_url"] -> SRT/VTT upload -> subtitle_url
    return {
        "subtitle_url": None,
        "meta": {**existing, "subtitles": "stub"},
    }
