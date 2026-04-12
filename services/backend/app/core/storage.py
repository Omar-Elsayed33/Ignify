"""MinIO storage client for Ignify.

Provides upload helpers that gracefully degrade to stub mode if MinIO or the
minio lib are unavailable, returning the original URL so callers do not break.
"""
from __future__ import annotations

import io
import uuid

import httpx

from app.core.config import settings

try:
    from minio import Minio
except ImportError:  # pragma: no cover - optional dep
    Minio = None  # type: ignore[assignment]

_client = None


def _get_client():
    global _client
    if _client is None and Minio is not None:
        try:
            _client = Minio(
                settings.MINIO_ENDPOINT,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=False,
            )
            # Ensure bucket exists
            try:
                if not _client.bucket_exists(settings.MINIO_BUCKET):
                    _client.make_bucket(settings.MINIO_BUCKET)
            except Exception:
                pass
        except Exception:
            _client = None
    return _client


async def upload_bytes(
    data: bytes,
    filename: str,
    content_type: str = "application/octet-stream",
) -> str:
    """Upload raw bytes to MinIO and return a public URL.

    Returns empty string if MinIO is not reachable / not configured.
    """
    client = _get_client()
    if client is None:
        return ""
    key = f"{uuid.uuid4().hex}/{filename}"
    try:
        client.put_object(
            settings.MINIO_BUCKET,
            key,
            io.BytesIO(data),
            length=len(data),
            content_type=content_type,
        )
    except Exception:
        return ""
    host = settings.MINIO_PUBLIC_HOST or "localhost:9000"
    return f"http://{host}/{settings.MINIO_BUCKET}/{key}"


async def upload_from_url(url: str, filename_hint: str = "media") -> str:
    """Download from an external URL and re-upload to MinIO.

    Returns the original URL (as fallback) if MinIO upload fails, so callers can
    keep their existing flow without breakage.
    """
    if not url:
        return ""
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            ext = (
                url.rsplit(".", 1)[-1].split("?")[0][:5]
                if "." in url.rsplit("/", 1)[-1]
                else "bin"
            )
            name = f"{filename_hint}.{ext}"
            content_type = resp.headers.get("content-type", "application/octet-stream")
            uploaded = await upload_bytes(resp.content, name, content_type)
            return uploaded or url
    except Exception:
        return url
