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

DEFAULT_LIMIT = 0.50  # matches Free-tier dollar cap — safer fallback than $2.50


def _plan_budget_from_catalog(plan_slug: str | None) -> float | None:
    """Read `limits.ai_budget_usd` from DEFAULT_PLANS — the single source of
    truth after Phase 6. Returns None if the slug isn't in the catalog so the
    caller can fall back to DEFAULT_LIMIT.

    Local import avoids a module-load cycle (billing.service imports crypto
    which imports config which is loaded before this module).
    """
    if not plan_slug:
        return None
    try:
        from app.modules.billing.service import DEFAULT_PLANS
    except Exception:  # pragma: no cover — shouldn't happen at runtime
        return None
    for p in DEFAULT_PLANS:
        if p.get("slug") == plan_slug:
            limits = p.get("limits", {}) or {}
            v = limits.get("ai_budget_usd")
            if isinstance(v, (int, float)):
                return float(v)
    return None


# Kept for back-compat with any external callers — now derived from catalog.
PLAN_AI_LIMITS: dict[str, float] = {}  # populated lazily by limit_for_plan


def _manager_key() -> str:
    """Sync resolver — env-only fallback for paths without DB access.

    Phase 12: prefer `get_manager_key_async(db)` from any code path that
    has an AsyncSession. The DB-backed admin setting takes priority there;
    this sync version stays as the bootstrap fallback (used only by
    paths that legitimately can't await — currently none after we wire
    the admin endpoints).
    """
    return settings.OPENROUTER_MANAGER_KEY or settings.OPENROUTER_API_KEY


async def get_manager_key_async(db) -> str:
    """Async-aware manager-key resolver. Reads from admin_settings table
    first (admin can rotate via UI without env redeploy), falls back to
    OPENROUTER_MANAGER_KEY env var, then to OPENROUTER_API_KEY.

    Use this from request handlers that already have an AsyncSession.
    """
    try:
        from app.core.admin_settings import KEY_OPENROUTER_MANAGER, get_setting
        db_value = await get_setting(db, KEY_OPENROUTER_MANAGER)
        if db_value:
            return db_value
    except Exception as exc:  # noqa: BLE001
        logger.warning("admin_settings lookup failed, falling back to env: %s", exc)
    return _manager_key()


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_manager_key()}",
        "Content-Type": "application/json",
    }


def limit_for_plan(plan_slug: str | None) -> float:
    """Return the monthly AI dollar budget for a plan slug.

    Phase 7 P1: reads from billing.DEFAULT_PLANS so there's exactly one source
    of truth. If a slug isn't in the catalog, falls back to DEFAULT_LIMIT
    ($0.50 — matches Free tier, fail-safe).
    """
    v = _plan_budget_from_catalog(plan_slug)
    return v if v is not None else DEFAULT_LIMIT


def build_key_name(tenant_id: str) -> str:
    """Canonical OpenRouter sub-key name: the raw tenant UUID, nothing else.

    Explicit helper so the rule is reviewable, testable, and impossible to
    drift across the 3 code paths that call OpenRouter's keys API
    (tenant signup, subscription activation / plan change, admin re-
    provisioning).

    Rules (enforced by tests):
      - no "ignify" prefix
      - no tenant name / user email / timestamp
      - no truncation — full UUID string
      - whatever OpenRouter dashboard shows for this key will match the
        tenant_id we can look up in our own DB.
    """
    return str(tenant_id)


async def provision_key(
    tenant_id: str,
    tenant_name: str,  # kept for signature stability; no longer used in key name
    plan_slug: str | None,
    db=None,
) -> dict[str, Any]:
    """Create a new sub-key for a tenant. Returns {key_id, key, limit}.

    Returns empty dict silently when no manager key is available (neither
    DB-stored admin setting nor env var). `tenant_name` was previously used
    in the key name; kept as argument for backward compat — used now only
    as OpenRouter's `label` field.

    Phase 12: when an `AsyncSession` is passed via `db`, prefer the
    DB-stored admin setting for the manager key. Backward-compatible:
    callers that don't pass `db` get the env-var fallback.
    """
    manager_key = await get_manager_key_async(db) if db is not None else _manager_key()
    if not manager_key:
        logger.info("OpenRouter manager key not set — skipping sub-key provisioning")
        return {}
    limit = limit_for_plan(plan_slug)
    payload = {
        "name": build_key_name(tenant_id),
        "label": tenant_name[:64] if tenant_name else str(tenant_id),
        "limit": limit,
    }
    headers = {
        "Authorization": f"Bearer {manager_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(PROVISIONING_BASE, json=payload, headers=headers)
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
