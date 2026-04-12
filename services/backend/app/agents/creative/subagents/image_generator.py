"""ImageGenerator — calls Replicate (flux-schnell) to render images. Not an LLM sub-agent."""
from __future__ import annotations

import asyncio
from typing import Any

import httpx
from tenacity import AsyncRetrying, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.core.config import settings


REPLICATE_MODEL = "black-forest-labs/flux-schnell"
REPLICATE_BASE = "https://api.replicate.com/v1"


async def _poll_prediction(client: httpx.AsyncClient, prediction_url: str, timeout_s: float = 120.0) -> dict[str, Any]:
    deadline = asyncio.get_event_loop().time() + timeout_s
    while True:
        r = await client.get(prediction_url, headers={"Authorization": f"Bearer {settings.REPLICATE_API_TOKEN}"})
        r.raise_for_status()
        data = r.json()
        status = data.get("status")
        if status in ("succeeded", "failed", "canceled"):
            return data
        if asyncio.get_event_loop().time() > deadline:
            return data
        await asyncio.sleep(1.5)


async def _call_replicate(prompt: str, aspect_ratio: str, num_outputs: int = 4) -> list[str]:
    """Run flux-schnell prediction and return output image URLs."""
    headers = {
        "Authorization": f"Bearer {settings.REPLICATE_API_TOKEN}",
        "Content-Type": "application/json",
        "Prefer": "wait",
    }
    payload = {
        "input": {
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "num_outputs": num_outputs,
            "output_format": "webp",
        }
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
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
            return []

        output = data.get("output") or []
        if isinstance(output, str):
            output = [output]
        return [u for u in output if isinstance(u, str)]


async def run_image_generator(state) -> dict[str, Any]:
    """LangGraph node: generate images via Replicate."""
    existing_meta = state.get("meta", {}) or {}

    if not settings.REPLICATE_API_TOKEN:
        return {
            "image_urls": [],
            "meta": {**existing_meta, "error": "no replicate token, stub mode"},
        }

    prompt = state.get("prompt") or state.get("idea") or ""
    dims = state.get("dimensions") or "1:1"

    try:
        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(2),
            wait=wait_exponential(multiplier=1, min=1, max=4),
            retry=retry_if_exception_type((httpx.HTTPError,)),
            reraise=True,
        ):
            with attempt:
                urls = await _call_replicate(prompt, dims, num_outputs=4)
    except Exception as e:
        return {
            "image_urls": [],
            "meta": {**existing_meta, "error": f"replicate failed: {str(e)[:300]}"},
        }

    return {
        "image_urls": urls,
        "meta": {**existing_meta, "model": REPLICATE_MODEL, "count": len(urls)},
    }
