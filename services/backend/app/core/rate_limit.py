"""Simple Redis-backed per-tenant + per-IP rate limiter.

Fails-open on Redis outage: if Redis is unreachable, requests are permitted —
we log a warning rather than 503-ing the whole API.
"""
from __future__ import annotations

import logging
import time
from typing import Callable

from fastapi import Depends, HTTPException, Request, status
from redis import Redis
from redis.exceptions import RedisError

from app.core.config import settings

logger = logging.getLogger(__name__)

_redis: Redis | None = None


def _r() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


async def check_rate_limit(key: str, limit: int, window_seconds: int) -> None:
    try:
        r = _r()
        bucket = f"rl:{key}:{int(time.time() // window_seconds)}"
        count = r.incr(bucket)
        if count == 1:
            r.expire(bucket, window_seconds)
    except RedisError as e:
        logger.warning("rate_limit: redis unavailable, failing open (%s)", e)
        return
    if count > limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded",
        )


def rate_limit_dep(limit: int = 60, window_seconds: int = 60, scope: str = "user") -> Callable:
    """FastAPI dependency factory: rate limit by user.id if available, else IP.

    Uses raw get_current_user (not the CurrentUser Annotated alias) so that
    FastAPI's OpenAPI schema generation does not attempt to treat ``user`` as
    a Pydantic model field (which triggers ForwardRef resolution errors).
    """
    from app.db.models import User
    from app.dependencies import get_current_user

    if scope == "user":
        async def _check_user(
            request: Request,
            _current: User = Depends(get_current_user),
        ) -> None:
            ident = str(_current.id)
            await check_rate_limit(f"user:{ident}", limit, window_seconds)

        return Depends(_check_user)

    async def _check_ip(request: Request) -> None:
        ident = request.client.host if request.client else "unknown"
        await check_rate_limit(f"ip:{ident}", limit, window_seconds)

    return Depends(_check_ip)
