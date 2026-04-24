"""Protocol + dataclasses that every social connector must implement."""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Protocol, runtime_checkable

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import decrypt_token, encrypt_token
from app.db.models import SocialAccount, SocialPlatform


@dataclass
class TokenBundle:
    """Normalized token payload returned from an OAuth exchange / refresh."""
    access_token: str
    refresh_token: str | None = None
    expires_at: datetime | None = None
    # Sub-accounts derived from a single OAuth grant (e.g. FB Pages + linked IG users).
    # Each entry should be a kwargs dict accepted by `_upsert_account`.
    accounts: list[dict] = field(default_factory=list)


@dataclass
class PublishResult:
    external_id: str
    url: str | None = None


@runtime_checkable
class SocialConnector(Protocol):
    """Uniform interface for OAuth + publish per social platform."""

    platform: SocialPlatform
    scopes: list[str]
    # Whether the platform *requires* media on every post (e.g. Instagram).
    requires_media: bool
    supports_refresh: bool

    def is_configured(self) -> bool:
        """Return True if the platform's client-id/secret env vars are set."""
        ...

    def build_auth_url(self, state: str) -> str: ...

    async def exchange_code(self, code: str) -> TokenBundle: ...

    async def refresh(self, account: SocialAccount) -> TokenBundle | None:
        """Refresh a stored token. Return None if the connector doesn't support refresh."""
        ...

    async def publish(
        self,
        account: SocialAccount,
        content: str,
        media_urls: list[str],
    ) -> PublishResult: ...


def get_access_token(account: SocialAccount) -> str | None:
    """Read the decrypted access token for a SocialAccount.

    Handles both pre-migration plaintext rows and encrypted rows transparently
    via `core.crypto.decrypt_token`. Never log the return value.
    """
    return decrypt_token(account.access_token_encrypted)


def get_refresh_token(account: SocialAccount) -> str | None:
    """Read the decrypted refresh token for a SocialAccount (if persisted)."""
    return decrypt_token(getattr(account, "refresh_token_encrypted", None))


async def upsert_account(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    platform: SocialPlatform,
    account_id: str,
    name: str,
    access_token: str,
    refresh_token: str | None = None,
    expires_at: datetime | None = None,
) -> SocialAccount:
    """Upsert a SocialAccount row.

    Both access and refresh tokens are encrypted at rest via Fernet before being
    written to the DB. `expires_at` (when set) is stored so a background job can
    refresh tokens proactively instead of waiting for a 401.
    """
    from sqlalchemy import and_, select

    access_ct = encrypt_token(access_token)
    refresh_ct = encrypt_token(refresh_token) if refresh_token else None

    result = await db.execute(
        select(SocialAccount).where(
            and_(
                SocialAccount.tenant_id == tenant_id,
                SocialAccount.platform == platform,
                SocialAccount.account_id == account_id,
            )
        )
    )
    acct = result.scalar_one_or_none()
    if acct:
        acct.name = name
        acct.access_token_encrypted = access_ct
        # Only overwrite refresh_token if we actually received a new one —
        # some OAuth responses omit it on refresh and we want to keep the old one.
        if refresh_ct is not None:
            acct.refresh_token_encrypted = refresh_ct
        if expires_at is not None:
            acct.token_expires_at = expires_at
        acct.is_active = True
    else:
        acct = SocialAccount(
            tenant_id=tenant_id,
            platform=platform,
            account_id=account_id,
            name=name,
            access_token_encrypted=access_ct,
            refresh_token_encrypted=refresh_ct,
            token_expires_at=expires_at,
            is_active=True,
        )
        db.add(acct)
    return acct
