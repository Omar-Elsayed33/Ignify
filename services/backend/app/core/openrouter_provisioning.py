"""OpenRouter Provisioning API — manager key creates/manages per-tenant sub-keys.

OPENROUTER_MANAGER_KEY is the dedicated provisioning key with "Manage keys" permission.
It is used ONLY here — never sent to tenants or used for LLM inference.

Each tenant gets their own sub-key (stored encrypted in tenant_ai_config).
LLM calls use the tenant's own sub-key; the manager key is never reused for inference.
"""
from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

PROVISIONING_BASE = "https://openrouter.ai/api/v1/keys"

# Monthly AI credit limits per plan slug (USD)
PLAN_AI_LIMITS: dict[str, float] = {
    "free": 1.00,
    "starter": 2.50,
    "pro": 8.00,
    "agency": 22.00,
}
DEFAULT_LIMIT = 2.50


def _manager_key() -> str:
    """Return the provisioning manager key. Falls back to API key if not set."""
    return settings.OPENROUTER_MANAGER_KEY or settings.OPENROUTER_API_KEY


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_manager_key()}",
        "Content-Type": "application/json",
    }


def limit_for_plan(plan_slug: str | None) -> float:
    if not plan_slug:
        return DEFAULT_LIMIT
    return PLAN_AI_LIMITS.get(plan_slug, DEFAULT_LIMIT)


async def provision_key(tenant_id: str, tenant_name: str, plan_slug: str | None) -> dict[str, Any]:
    """Create a new sub-key for a tenant. Returns {key_id, key, limit}.

    Returns empty dict silently when OPENROUTER_MANAGER_KEY is not configured.
    """
    if not _manager_key():
        logger.info("OPENROUTER_MANAGER_KEY not set — skipping sub-key provisioning")
        return {}
    limit = limit_for_plan(plan_slug)
    payload = {
        "name": f"ignify-tenant-{tenant_id[:8]}",
        "label": tenant_name[:64],
        "limit": limit,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(PROVISIONING_BASE, json=payload, headers=_headers())
        if resp.status_code not in (200, 201):
            logger.error(
                "OpenRouter provision failed",
                extra={"tenant_id": tenant_id, "status": resp.status_code, "body": resp.text},
            )
            return {}
        data = resp.json()
        # OpenRouter returns: {key: "sk-or-...", key_id: "...", name: "...", limit: N, usage: N}
        return {
            "key_id": data.get("key_id") or data.get("id", ""),
            "key": data.get("key", ""),
            "limit": float(data.get("limit", limit)),
        }


async def get_key_usage(key_id: str) -> dict[str, Any]:
    """Fetch current usage for a tenant sub-key. Returns {usage, limit, remaining}."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(f"{PROVISIONING_BASE}/{key_id}", headers=_headers())
        if resp.status_code != 200:
            logger.warning("OpenRouter usage fetch failed", extra={"key_id": key_id, "status": resp.status_code})
            return {}
        data = resp.json()
        usage = float(data.get("usage", 0))
        limit = float(data.get("limit", 0))
        return {
            "usage": usage,
            "limit": limit,
            "remaining": max(0.0, limit - usage),
        }


async def update_key_limit(key_id: str, new_limit: float) -> bool:
    """Update the monthly credit limit for a tenant's sub-key (e.g. on plan upgrade)."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.put(
            f"{PROVISIONING_BASE}/{key_id}",
            json={"limit": new_limit},
            headers=_headers(),
        )
        if resp.status_code != 200:
            logger.error("OpenRouter limit update failed", extra={"key_id": key_id, "status": resp.status_code})
            return False
        return True


async def delete_key(key_id: str) -> bool:
    """Delete a tenant's sub-key (called on account deletion)."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.delete(f"{PROVISIONING_BASE}/{key_id}", headers=_headers())
        return resp.status_code in (200, 204)


async def reset_key_limit(key_id: str, limit: float) -> bool:
    """Reset the monthly limit (PUT with same limit resets usage counter on OpenRouter)."""
    return await update_key_limit(key_id, limit)
