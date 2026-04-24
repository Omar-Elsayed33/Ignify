"""Small helper: ask OpenRouter for a JSON response.

Several older routers (campaigns, seo audit) previously made direct OpenAI /
Anthropic API calls via a separate AGNO runtime service. Those paths
bypassed the OpenRouter-only provider policy and the tenant-bound spend
ledger. This helper replaces them — same ergonomics, but every call goes
through `app.core.llm.get_llm_for_tenant()` which routes through OpenRouter
with the tenant's provisioned sub-key.

Usage:
    plan = await llm_json(
        db, tenant_id,
        system="You are a marketing planner. Reply in JSON only.",
        user=prompt,
        model="openai/gpt-4o",
    )

Notes
-----
- Model names must be OpenRouter IDs (`openai/gpt-4o`, `anthropic/claude-sonnet-4.5`,
  `google/gemini-2.5-flash`, etc.) — NOT raw provider model names.
- Returns a parsed dict. Raises `ValueError` if the model returns non-JSON.
- Caller is responsible for cost pre-flight (`ai_budget.check`) and for
  calling `ai_budget.record` after success.
"""
from __future__ import annotations

import json as _json
import logging
import uuid
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm import get_llm_for_tenant

logger = logging.getLogger(__name__)


async def llm_json(
    db: Any,
    tenant_id: str | uuid.UUID,
    *,
    system: str,
    user: str,
    model: str = "openai/gpt-4o",
    temperature: float = 0.4,
    max_tokens: int | None = 4096,
) -> dict[str, Any]:
    """Ask the tenant's OpenRouter key for a JSON response and parse it."""
    llm = await get_llm_for_tenant(
        model=model,
        tenant_id=str(tenant_id),
        db=db,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    resp = await llm.ainvoke(
        [SystemMessage(content=system), HumanMessage(content=user)]
    )
    text = (getattr(resp, "content", "") or "").strip()
    # Strip the common ```json ... ``` fence some models add.
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        text = text.rsplit("```", 1)[0].strip()
    try:
        return _json.loads(text)
    except _json.JSONDecodeError as exc:
        logger.warning(
            "llm_json: model returned non-JSON (tenant=%s, model=%s): %s",
            tenant_id, model, text[:200],
        )
        raise ValueError(f"Model did not return valid JSON: {exc}") from exc
