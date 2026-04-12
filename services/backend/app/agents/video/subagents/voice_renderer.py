"""VoiceRenderer — renders the script to speech via ElevenLabs TTS."""
from __future__ import annotations

import base64
from typing import Any

import httpx
from tenacity import AsyncRetrying, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.core.config import settings


ELEVEN_BASE = "https://api.elevenlabs.io/v1"
DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM"


async def _call_elevenlabs(script: str, voice_id: str) -> bytes:
    headers = {
        "xi-api-key": settings.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    payload = {
        "text": script,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(
            f"{ELEVEN_BASE}/text-to-speech/{voice_id}",
            headers=headers,
            json=payload,
        )
        r.raise_for_status()
        return r.content


async def run_voice_renderer(state) -> dict[str, Any]:
    existing = state.get("meta", {}) or {}
    script = state.get("script") or ""
    voice_id = state.get("voice_id") or DEFAULT_VOICE

    if not settings.ELEVENLABS_API_KEY:
        return {
            "voice_url": None,
            "meta": {**existing, "tts_status": "stub_no_key"},
        }

    if not script.strip():
        return {
            "voice_url": None,
            "meta": {**existing, "tts_status": "skipped_empty_script"},
        }

    try:
        audio_bytes: bytes = b""
        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(2),
            wait=wait_exponential(multiplier=1, min=1, max=4),
            retry=retry_if_exception_type((httpx.HTTPError,)),
            reraise=True,
        ):
            with attempt:
                audio_bytes = await _call_elevenlabs(script, voice_id)
    except Exception as e:
        return {
            "voice_url": None,
            "meta": {**existing, "tts_status": f"failed: {str(e)[:300]}"},
        }

    # TODO: upload audio_bytes to MinIO and return a signed URL. For now emit a
    # data URL so the frontend can still preview the audio.
    b64 = base64.b64encode(audio_bytes).decode("ascii")
    voice_url = f"data:audio/mpeg;base64,{b64}"

    return {
        "voice_url": voice_url,
        "meta": {**existing, "tts_status": "ok", "tts_bytes": len(audio_bytes), "tts_voice_id": voice_id},
    }
