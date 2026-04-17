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
    via `core.crypto.decrypt_token`.
    """
    return decrypt_token(account.access_token_encrypted)


async def upsert_account(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    platform: SocialPlatform,
    account_id: str,
    name: str,
    access_token: str,
    refresh_token: str | None = None,
    expires_at: datetime | None = None,  # noqa: ARG001  (column not yet present)
) -> SocialAccount:
    """Upsert a SocialAccount row. Access token is encrypted at rest via Fernet."""
    from sqlalchemy import and_, select

    ciphertext = encrypt_token(access_token)

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
        acct.access_token_encrypted = ciphertext
        acct.is_active = True
    else:
        acct = SocialAccount(
            tenant_id=tenant_id,
            platform=platform,
            account_id=account_id,
            name=name,
            access_token_encrypted=ciphertext,
            is_active=True,
        )
        db.add(acct)
    return acct
