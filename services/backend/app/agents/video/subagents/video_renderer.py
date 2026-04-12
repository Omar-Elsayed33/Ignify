"""VideoRenderer — renders scenes to a short video via Replicate."""
from __future__ import annotations

import asyncio
from typing import Any

import httpx
from tenacity import AsyncRetrying, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.core.config import settings


REPLICATE_MODEL = "minimax/video-01"
REPLICATE_BASE = "https://api.replicate.com/v1"


async def _poll_prediction(client: httpx.AsyncClient, prediction_url: str, timeout_s: float = 600.0) -> dict[str, Any]:
    deadline = asyncio.get_event_loop().time() + timeout_s
    while True:
        r = await client.get(
            prediction_url,
            headers={"Authorization": f"Bearer {settings.REPLICATE_API_TOKEN}"},
        )
        r.raise_for_status()
        data = r.json()
        status = data.get("status")
        if status in ("succeeded", "failed", "canceled"):
            return data
        if asyncio.get_event_loop().time() > deadline:
            return data
        await asyncio.sleep(2.5)


async def _call_replicate(prompt: str, aspect_ratio: str) -> str | None:
    headers = {
        "Authorization": f"Bearer {settings.REPLICATE_API_TOKEN}",
        "Content-Type": "application/json",
        "Prefer": "wait",
    }
    payload = {
        "input": {
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
        }
    }

    async with httpx.AsyncClient(timeout=600.0) as client:
        r = await client.post(
            f"{REPLICATE_BASE}/models/{REPLICATE_MODEL}/predictions",
            headers=headers,
            json=payload,
        )
        r.raise_for_status()
        data = r.json()

        if data.get("status") not in ("succeeded", "failed", "canceled"):
            url = (data.get("urls") or {}).get("get")
            if url:
                data = await _poll_prediction(client, url)

        if data.get("status") != "succeeded":
            return None

        output = data.get("output")
        if isinstance(output, str):
            return output
        if isinstance(output, list) and output:
            first = output[0]
            if isinstance(first, str):
                return first
        return None


async def run_video_renderer(state) -> dict[str, Any]:
    existing = state.get("meta", {}) or {}
    scenes = state.get("scenes") or []
    aspect = state.get("aspect_ratio", "9:16")

    if not settings.REPLICATE_API_TOKEN:
        return {
            "video_url": None,
            "meta": {**existing, "video_status": "stub_no_token"},
        }

    # Join scene visual prompts into a single narrative prompt for the model.
    joined_prompt = " ".join(
        s.get("visual_prompt", "") for s in scenes if isinstance(s, dict)
    ).strip() or (state.get("idea") or "")

    if not joined_prompt:
        return {
            "video_url": None,
            "meta": {**existing, "video_status": "skipped_empty_prompt"},
        }

    try:
        url: str | None = None
        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(2),
            wait=wait_exponential(multiplier=1, min=1, max=4),
            retry=retry_if_exception_type((httpx.HTTPError,)),
            reraise=True,
        ):
            with attempt:
                url = await _call_replicate(joined_prompt, aspect)
    except Exception as e:
        return {
            "video_url": None,
            "meta": {**existing, "video_status": f"failed: {str(e)[:300]}"},
        }

    return {
        "video_url": url,
        "meta": {**existing, "video_status": "ok" if url else "no_output", "video_model": REPLICATE_MODEL},
    }
