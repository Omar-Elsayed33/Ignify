"""Short-lived state token store for OAuth redirects.

In-memory TTL dict — acceptable until we scale past one backend replica. Swap
for Redis with `SETEX` when that happens; the surface here is intentionally
minimal (issue / pop) so the callsite won't change.
"""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

_STATE_TTL = timedelta(minutes=10)
_store: dict[str, dict[str, Any]] = {}


def _purge_expired() -> None:
    now = datetime.now(timezone.utc)
    dead = [k for k, v in _store.items() if v["expires_at"] < now]
    for k in dead:
        _store.pop(k, None)


def issue(tenant_id: uuid.UUID, platform: str, extra: dict[str, Any] | None = None) -> str:
    """Create a state token bound to a tenant and return it."""
    _purge_expired()
    state = secrets.token_urlsafe(32)
    _store[state] = {
        "tenant_id": str(tenant_id),
        "platform": platform,
        "extra": extra or {},
        "expires_at": datetime.now(timezone.utc) + _STATE_TTL,
    }
    return state


def pop(state: str) -> dict[str, Any] | None:
    """One-shot fetch — state token is invalidated after use."""
    _purge_expired()
    return _store.pop(state, None)
