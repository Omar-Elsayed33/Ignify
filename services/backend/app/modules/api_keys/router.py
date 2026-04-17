"""Tenant-scoped API keys — create / list / revoke.

Key format: `ignf_live_<24 random base64 chars>`. We display the full key exactly ONCE
at creation time; only the hash + prefix are persisted.

Auth middleware lookup is implemented in `app.dependencies.api_key_auth`.
"""
from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.db.models import ApiKey
from app.dependencies import CurrentUser, DbSession

router = APIRouter(prefix="/api-keys", tags=["api-keys"])


class CreateApiKeyRequest(BaseModel):
    name: str
    scope: str = "read"  # "read" | "write"


class ApiKeyResponse(BaseModel):
    id: str
    name: str
    prefix: str
    scope: str
    last_used_at: Optional[datetime]
    revoked_at: Optional[datetime]
    created_at: datetime


class CreateApiKeyResponse(BaseModel):
    # The full key — shown ONCE, then discarded.
    key: str
    record: ApiKeyResponse


def _serialize(row: ApiKey) -> ApiKeyResponse:
    return ApiKeyResponse(
        id=str(row.id),
        name=row.name,
        prefix=row.prefix,
        scope=row.scope,
        last_used_at=row.last_used_at,
        revoked_at=row.revoked_at,
        created_at=row.created_at,
    )


def _generate_key() -> tuple[str, str, str]:
    """Returns (full_key, prefix, sha256_hash)."""
    raw = secrets.token_urlsafe(24)
    full = f"ignf_live_{raw}"
    prefix = full[:16]  # "ignf_live_XXXXXX"
    key_hash = hashlib.sha256(full.encode("utf-8")).hexdigest()
    return full, prefix, key_hash


@router.get("", response_model=list[ApiKeyResponse])
async def list_api_keys(user: CurrentUser, db: DbSession):
    if user.role not in {"owner", "admin", "superadmin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")

    result = await db.execute(
        select(ApiKey)
        .where(ApiKey.tenant_id == user.tenant_id)
        .order_by(ApiKey.created_at.desc())
    )
    return [_serialize(r) for r in result.scalars().all()]


@router.post("", response_model=CreateApiKeyResponse, status_code=201)
async def create_api_key(
    data: CreateApiKeyRequest, user: CurrentUser, db: DbSession
):
    if user.role not in {"owner", "admin", "superadmin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")
    if data.scope not in {"read", "write"}:
        raise HTTPException(status_code=400, detail="invalid_scope")

    full_key, prefix, key_hash = _generate_key()
    row = ApiKey(
        tenant_id=user.tenant_id,
        created_by=user.id,
        name=data.name[:255] or "Untitled key",
        prefix=prefix,
        key_hash=key_hash,
        scope=data.scope,
    )
    db.add(row)
    await db.flush()
    return CreateApiKeyResponse(key=full_key, record=_serialize(row))


@router.delete("/{key_id}", status_code=204)
async def revoke_api_key(key_id: uuid.UUID, user: CurrentUser, db: DbSession):
    if user.role not in {"owner", "admin", "superadmin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")

    result = await db.execute(
        select(ApiKey).where(
            ApiKey.id == key_id, ApiKey.tenant_id == user.tenant_id
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")

    row.revoked_at = datetime.now(timezone.utc)
    await db.flush()
    return
