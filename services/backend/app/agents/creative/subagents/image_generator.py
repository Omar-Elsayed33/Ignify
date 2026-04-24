"""ImageGenerator — plan-aware image-gen via Replicate.

Phase 8 upgrade
---------------
- Model is now selected by the plan tier via
  `app.agents.creative.model_router.select_model()` — Free/Starter get
  Flux-Schnell, Growth gets Flux-Dev, Pro/Agency gets Flux 1.1 Pro.
- Cost and model metadata are returned in `meta` so the caller can
  record actual spend into `ai_budget` + persist to `CreativeAsset.metadata`.
- Supports `negative_prompt` for Flux Dev/Pro (schnell ignores it, we pass
  it anyway — harmless).
"""
from __future__ import annotations

import asyncio
from typing import Any

import httpx
from tenacity import AsyncRetrying, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.agents.creative.model_router import (
    CreativeModelSpec,
    record_actual_cost,
    select_model,
)
from app.core.config import settings


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


async def _call_replicate(
    spec: CreativeModelSpec,
    prompt: str,
    negative_prompt: str,
    aspect_ratio: str,
    num_outputs: int,
) -> list[str]:
    """POST to Replicate and return output image URLs."""
    headers = {
        "Authorization": f"Bearer {settings.REPLICATE_API_TOKEN}",
        "Content-Type": "application/json",
        "Prefer": "wait",
    }
    input_block: dict[str, Any] = {
        "prompt": prompt,
        "aspect_ratio": aspect_ratio,
        "num_outputs": num_outputs,
        "output_format": "webp",
    }
    # Flux-Dev + Flux-Pro accept negative prompts; schnell silently ignores.
    if negative_prompt:
        input_block["negative_prompt"] = negative_prompt

    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(
            f"{REPLICATE_BASE}/models/{spec.replicate_slug}/predictions",
            headers=headers,
            json={"input": input_block},
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
    """LangGraph node: generate images via Replicate with plan-tier routing.

    Expects `state["plan_slug"]` to be set by the caller (service layer).
    Falls back to Free tier (Flux-Schnell) if not provided — safe default.

    Output keys:
      - image_urls: list[str]
      - meta: {model, quality_label, plan_slug, count, cost_usd, error?}
    """
    existing_meta = state.get("meta", {}) or {}
    plan_slug = state.get("plan_slug")
    spec = select_model(plan_slug)

    if not settings.REPLICATE_API_TOKEN:
        return {
            "image_urls": [],
            "meta": {
                **existing_meta,
                "model": spec.replicate_slug,
                "quality_label": spec.quality_label,
                "plan_slug": plan_slug,
                "count": 0,
                "cost_usd": 0.0,
                "error": "no replicate token, stub mode",
            },
        }

    prompt = state.get("prompt") or state.get("idea") or ""
    negative_prompt = state.get("negative_prompt") or ""
    dims = state.get("dimensions") or (state.get("brief") or {}).get("aspect_ratio") or "1:1"
    # Allow caller to override output count (e.g. cost-constrained runs);
    # default to the spec's default_outputs (higher for cheaper models).
    num_outputs = state.get("num_outputs") or spec.default_outputs

    try:
        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(2),
            wait=wait_exponential(multiplier=1, min=1, max=4),
            retry=retry_if_exception_type((httpx.HTTPError,)),
            reraise=True,
        ):
            with attempt:
                urls = await _call_replicate(spec, prompt, negative_prompt, dims, num_outputs)
    except Exception as e:
        return {
            "image_urls": [],
            "meta": {
                **existing_meta,
                "model": spec.replicate_slug,
                "quality_label": spec.quality_label,
                "plan_slug": plan_slug,
                "count": 0,
                "cost_usd": 0.0,
                "error": f"replicate failed: {str(e)[:300]}",
            },
        }

    return {
        "image_urls": urls,
        "meta": {
            **existing_meta,
            "model": spec.replicate_slug,
            "quality_label": spec.quality_label,
            "plan_slug": plan_slug,
            "count": len(urls),
            "cost_usd": record_actual_cost(spec, len(urls)),
        },
    }
