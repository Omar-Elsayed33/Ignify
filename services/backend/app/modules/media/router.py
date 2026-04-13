"""Generic media upload endpoint (logos, images).

Accepts multipart/form-data and forwards to MinIO via core.storage.
Gracefully falls back to a data URL if MinIO is unavailable so the frontend
can still show a preview.
"""
from __future__ import annotations

import base64

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.core.rate_limit_presets import MEDIUM
from app.core.storage import upload_bytes
from app.dependencies import CurrentUser

router = APIRouter(prefix="/media", tags=["media"])

_MAX_BYTES = 5 * 1024 * 1024  # 5 MB
_ALLOWED_CTS = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/svg+xml",
    "image/webp",
    "image/gif",
}


@router.post("/upload", dependencies=[MEDIUM])
async def upload_media(user: CurrentUser, file: UploadFile = File(...)):
    if file.content_type not in _ALLOWED_CTS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported content type: {file.content_type}",
        )

    data = await file.read()
    if len(data) > _MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {_MAX_BYTES // (1024 * 1024)}MB limit",
        )

    fname = file.filename or "upload"
    url = await upload_bytes(data, fname, content_type=file.content_type or "application/octet-stream")
    if not url:
        # Fallback: inline data URL so the frontend still has something usable.
        b64 = base64.b64encode(data).decode("ascii")
        url = f"data:{file.content_type};base64,{b64}"
    return {"url": url, "filename": fname, "size": len(data), "content_type": file.content_type}
