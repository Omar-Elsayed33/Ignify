"""Redis-backed OAuth state store for social/SEO OAuth redirects.

Why Redis (and not in-memory):
- The state token lives between the auth-url redirect and the callback. Any
  backend restart — deploy, crash, autoscaler recycle — would lose an in-memory
  dict and break all in-progress OAuth flows silently.
- Multiple backend replicas behind a load balancer must share state.

Contract:
- `issue(tenant_id, platform, extra)` → returns a state string, writes a record
  to Redis with a short TTL (10 minutes).
- `pop(state)` → atomically returns the record and deletes it (one-shot use).
  Returns None for unknown, expired, or already-consumed state tokens.
- Replay attacks are defeated by the GETDEL atomicity: if two callbacks race
  with the same state, only one sees the record.

Failure mode:
- If Redis is unavailable, `issue()` raises RuntimeError (OAuth cannot safely
  proceed without a trusted state store) and the user sees a "try again" page.
- `pop()` returns None on Redis errors, which the callback treats as an
  invalid/expired state — i.e. safely fails closed.
"""
from __future__ import annotations

import json
import logging
import secrets
import uuid
from typing import Any

from redis import Redis
from redis.exceptions import RedisError

from app.core.config import settings

logger = logging.getLogger(__name__)

_STATE_TTL_SECONDS = 600  # 10 minutes — matches every platform's auth timeout
_KEY_PREFIX = "oauth_state:"

_redis: Redis | None = None


def _client() -> Redis:
    """Lazily construct a Redis client. Decodes responses as str."""
    global _redis
    if _redis is None:
        _redis = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


def _reset_client_for_tests() -> None:
    """Test hook: force the module to re-create the client on next use."""
    global _redis
    _redis = None


def issue(
    tenant_id: uuid.UUID,
    platform: str,
    extra: dict[str, Any] | None = None,
) -> str:
    """Create a state token bound to a tenant and return it.

    Raises RuntimeError if Redis is unreachable — OAuth must not proceed with
    an unverifiable state.
    """
    state = secrets.token_urlsafe(32)
    payload = json.dumps({
        "tenant_id": str(tenant_id),
        "platform": platform,
        "extra": extra or {},
    })
    try:
        # SET ... NX EX: write only if the key does not exist (collision → fail).
        # token_urlsafe(32) gives ~256 bits; collision probability is negligible
        # but NX makes it explicit.
        ok = _client().set(
            _KEY_PREFIX + state,
            payload,
            nx=True,
            ex=_STATE_TTL_SECONDS,
        )
    except RedisError as e:
        logger.error("oauth_state: redis unavailable on issue: %s", e)
        raise RuntimeError("OAuth state store unavailable — try again") from e
    if not ok:
        # Astronomical odds, but handle it.
        logger.error("oauth_state: state token collision — refusing to issue")
        raise RuntimeError("OAuth state collision — try again")
    return state


def pop(state: str) -> dict[str, Any] | None:
    """One-shot fetch — state token is invalidated after use.

    Uses Redis GETDEL for atomic read+delete (Redis 6.2+), preventing replay
    if two callbacks arrive concurrently. Returns None on miss, expiry,
    already-consumed, or any Redis error (fail-closed).
    """
    if not state:
        return None
    try:
        raw = _client().getdel(_KEY_PREFIX + state)
    except RedisError as e:
        logger.error("oauth_state: redis unavailable on pop: %s", e)
        return None
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        logger.error("oauth_state: corrupt state payload — discarding")
        return None
