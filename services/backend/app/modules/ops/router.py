"""Public ops endpoints: detailed status, readiness probe, liveness probe.

- ``GET /ops/status`` : deep check of db, redis, object storage, provider keys.
- ``GET /ops/ready``  : readiness probe (DB + Redis must respond). 503 on failure.
- ``GET /ops/live``   : liveness probe — always 200 if the process is up.
"""
from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, Response, status
from sqlalchemy import text

from app.core.config import settings
from app.db.database import async_session

router = APIRouter(prefix="/ops", tags=["ops"])

_START_TS = time.time()
_VERSION = "0.1.0"


async def _check_db() -> str:
    try:
        async with async_session() as db:
            await db.execute(text("SELECT 1"))
        return "ok"
    except Exception:
        return "error"


async def _check_redis() -> str:
    try:
        import redis.asyncio as aioredis  # type: ignore
        client = aioredis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        try:
            await client.ping()
            return "ok"
        finally:
            await client.aclose()
    except Exception:
        return "error"


async def _check_minio() -> str:
    try:
        import aiohttp  # type: ignore
        # MinIO exposes /minio/health/live
        host = settings.MINIO_ENDPOINT
        url = f"http://{host}/minio/health/live"
        timeout = aiohttp.ClientTimeout(total=2)
        async with aiohttp.ClientSession(timeout=timeout) as s:
            async with s.get(url) as r:
                return "ok" if r.status < 500 else "error"
    except Exception:
        # Fall back to TCP connect check
        try:
            import socket
            host, _, port = settings.MINIO_ENDPOINT.partition(":")
            with socket.create_connection((host, int(port or 9000)), timeout=2):
                return "ok"
        except Exception:
            return "error"


def _providers() -> dict[str, bool]:
    return {
        "openrouter": bool(settings.OPENROUTER_API_KEY),
        "openai": bool(settings.OPENAI_API_KEY),
        "anthropic": bool(settings.ANTHROPIC_API_KEY),
        "google": bool(settings.GOOGLE_API_KEY),
        "replicate": bool(settings.REPLICATE_API_TOKEN),
        "elevenlabs": bool(settings.ELEVENLABS_API_KEY),
        "stripe": bool(settings.STRIPE_SECRET_KEY),
        "paymob": bool(settings.PAYMOB_API_KEY),
        "paytabs": bool(settings.PAYTABS_SERVER_KEY),
        "meta": bool(settings.META_APP_ID and settings.META_APP_SECRET),
        "smtp": bool(settings.SMTP_HOST),
    }


@router.get("/status")
async def status_endpoint() -> dict[str, Any]:
    db_s = await _check_db()
    redis_s = await _check_redis()
    minio_s = await _check_minio()
    return {
        "version": _VERSION,
        "app": settings.APP_NAME,
        "debug": settings.DEBUG,
        "uptime_seconds": int(time.time() - _START_TS),
        "db": db_s,
        "redis": redis_s,
        "minio": minio_s,
        "providers": _providers(),
    }


@router.get("/ready")
async def ready_endpoint(response: Response) -> dict[str, Any]:
    db_s = await _check_db()
    redis_s = await _check_redis()
    ok = db_s == "ok" and redis_s == "ok"
    if not ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"ready": ok, "db": db_s, "redis": redis_s}


@router.get("/live")
async def live_endpoint() -> dict[str, Any]:
    return {"alive": True, "uptime_seconds": int(time.time() - _START_TS)}
