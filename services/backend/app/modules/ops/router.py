"""Public ops endpoints: detailed status, readiness probe, liveness probe.

- ``GET /ops/status`` : deep check of db, redis, object storage, worker, providers.
  Protected by `OPS_STATUS_TOKEN` in production (info-disclosure risk otherwise).
- ``GET /ops/ready``  : readiness probe — DB + Redis + MinIO must respond. 503 on failure.
- ``GET /ops/live``   : liveness probe — 200 if the process is up.

K8s wiring:
  livenessProbe  → /ops/live   (restart pod if fails)
  readinessProbe → /ops/ready  (remove from service if fails — temporary)
"""
from __future__ import annotations

import os
import time
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Response, status
from sqlalchemy import text

from app.core.config import settings
from app.db.database import async_session

router = APIRouter(prefix="/ops", tags=["ops"])

_START_TS = time.time()
_VERSION = "0.1.0"

# How long a worker heartbeat check is allowed to take. Celery inspect talks to
# workers over the broker and can block if no workers are responsive.
_CELERY_INSPECT_TIMEOUT_SECONDS = 2.0


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


def _check_worker_sync() -> dict[str, Any]:
    """Return worker health status by asking Celery via the broker.

    `ping()` is a broadcast to all workers; each responds with `{hostname: "pong"}`.
    A zero-worker response or a timeout means no worker is alive.

    Runs synchronously — Celery's control client isn't asyncio-aware. The FastAPI
    handler calls this via `asyncio.to_thread` so the event loop stays responsive.
    """
    try:
        from app.worker import celery_app
        inspector = celery_app.control.inspect(timeout=_CELERY_INSPECT_TIMEOUT_SECONDS)
        pings = inspector.ping() or {}
        if not pings:
            return {"status": "down", "worker_count": 0}
        return {"status": "ok", "worker_count": len(pings)}
    except Exception as exc:  # noqa: BLE001
        return {"status": "error", "error": str(exc)[:200]}


async def _check_worker() -> dict[str, Any]:
    import asyncio
    return await asyncio.to_thread(_check_worker_sync)


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


def _require_status_token(x_ops_token: str | None) -> None:
    """Enforce an internal bearer token on /ops/status in production.

    Development (DEBUG=true): always allowed (no token required).
    Production (DEBUG=false):
        - If OPS_STATUS_TOKEN env var is set, require it in X-Ops-Token header.
        - If it's unset, allow access but the operator is encouraged to set
          one. We don't fail closed because making the only diagnostic
          endpoint unreachable on a misconfigured prod would trade info-
          disclosure for pure unavailability.
    """
    if settings.DEBUG:
        return
    expected = os.environ.get("OPS_STATUS_TOKEN", "")
    if not expected:
        return
    if not x_ops_token or x_ops_token != expected:
        raise HTTPException(status_code=401, detail="ops_token_invalid")


@router.get("/status")
async def status_endpoint(
    x_ops_token: str | None = Header(default=None, alias="X-Ops-Token"),
) -> dict[str, Any]:
    _require_status_token(x_ops_token)
    db_s = await _check_db()
    redis_s = await _check_redis()
    minio_s = await _check_minio()
    worker_s = await _check_worker()
    return {
        "version": _VERSION,
        "app": settings.APP_NAME,
        "debug": settings.DEBUG,
        "uptime_seconds": int(time.time() - _START_TS),
        "db": db_s,
        "redis": redis_s,
        "minio": minio_s,
        "worker": worker_s,
        "providers": _providers(),
    }


@router.get("/ready")
async def ready_endpoint(response: Response) -> dict[str, Any]:
    """Readiness probe. Returns 503 if any critical dependency is down.

    Includes MinIO because media upload + creative storage break without it.
    Worker status is deliberately NOT included: readiness is about whether
    this pod can serve HTTP; a worker outage shouldn't take the API pod out
    of rotation. Worker health is reported via /ops/status.
    """
    db_s = await _check_db()
    redis_s = await _check_redis()
    minio_s = await _check_minio()
    ok = db_s == "ok" and redis_s == "ok" and minio_s == "ok"
    if not ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"ready": ok, "db": db_s, "redis": redis_s, "minio": minio_s}


@router.get("/live")
async def live_endpoint() -> dict[str, Any]:
    """Liveness probe. Always 200 if the process is serving requests.

    Deliberately does NOT check DB/Redis/MinIO — those failures should trigger
    readiness removal (temporary backoff), not a pod restart (cascading churn).
    """
    return {"alive": True, "uptime_seconds": int(time.time() - _START_TS)}
