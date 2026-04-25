"""Admin-managed platform settings store.

Single source of truth for admin-controlled secrets that used to live in
`.env` but should be rotatable from the admin UI without a redeploy.
Today: just `openrouter.manager_key`. The same shape will hold future
settings (Sentry DSN override, etc.) without a new migration.

Storage: rows in the `admin_settings` table, keyed by string. Sensitive
values (`is_secret=true`) are Fernet-encrypted via `app.core.crypto`
before persistence — same encryption as social tokens.

Read priority for sensitive settings:
  1. DB-backed admin setting (preferred — rotatable from /admin)
  2. Environment variable (fallback — bootstrap before first admin login)

This means the env var is OPTIONAL after the admin sets the key once.
Operators can leave OPENROUTER_MANAGER_KEY unset in production after
the initial admin sign-in.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import decrypt_token, encrypt_token
from app.db.models import AdminSetting

logger = logging.getLogger(__name__)


# Stable string keys — never change once shipped (used as DB lookup).
KEY_OPENROUTER_MANAGER = "openrouter.manager_key"


async def get_setting(
    db: AsyncSession, key: str, *, decrypt: bool = True
) -> str | None:
    """Return the plaintext value for an admin setting, or None if unset.

    For sensitive (is_secret=True) settings, the stored value is Fernet
    ciphertext; we decrypt before returning. Pass `decrypt=False` to get
    the raw stored value (for status checks that don't need the secret).
    """
    result = await db.execute(select(AdminSetting).where(AdminSetting.key == key))
    row = result.scalar_one_or_none()
    if row is None or not row.value:
        return None
    if not decrypt or not row.is_secret:
        return row.value
    return decrypt_token(row.value)


async def set_setting(
    db: AsyncSession,
    key: str,
    value: str | None,
    *,
    is_secret: bool = True,
    updated_by: uuid.UUID | None = None,
) -> AdminSetting:
    """Upsert an admin setting. Sensitive values are encrypted before write.

    Pass `value=None` (or empty string) to clear the setting — useful for
    rotating to a new key without leaving the old one stored.
    """
    result = await db.execute(select(AdminSetting).where(AdminSetting.key == key))
    row = result.scalar_one_or_none()
    stored_value: str | None
    if value is None or value == "":
        stored_value = None
    elif is_secret:
        stored_value = encrypt_token(value)
    else:
        stored_value = value

    now = datetime.now(timezone.utc)
    if row is None:
        row = AdminSetting(
            key=key,
            value=stored_value,
            is_secret=is_secret,
            updated_at=now,
            updated_by=updated_by,
        )
        db.add(row)
    else:
        row.value = stored_value
        row.is_secret = is_secret
        row.updated_at = now
        row.updated_by = updated_by
    await db.flush()
    return row


async def get_setting_status(db: AsyncSession, key: str) -> dict:
    """Status snapshot for the admin UI — never returns the secret value."""
    result = await db.execute(select(AdminSetting).where(AdminSetting.key == key))
    row = result.scalar_one_or_none()
    if row is None:
        return {"key": key, "configured": False, "is_secret": True, "updated_at": None}
    has_value = bool(row.value)
    return {
        "key": key,
        "configured": has_value,
        "is_secret": bool(row.is_secret),
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }
