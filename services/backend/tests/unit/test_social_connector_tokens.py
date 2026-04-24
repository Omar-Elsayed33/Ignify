"""P1-1: Unit tests for social connector token storage.

Verifies `upsert_account()` encrypts tokens at rest and persists refresh_token
+ token_expires_at — the fields that were previously silently dropped.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.crypto import _CIPHERTEXT_PREFIX
from app.db.models import SocialAccount, SocialPlatform
from app.integrations.social.base import (
    get_access_token,
    get_refresh_token,
    upsert_account,
)


pytestmark = pytest.mark.unit


def _mock_db_session(found: SocialAccount | None = None) -> AsyncMock:
    """Build an AsyncSession-like mock whose execute() yields `found` or None."""
    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none = MagicMock(return_value=found)
    db.execute = AsyncMock(return_value=result)
    db.add = MagicMock()
    db.flush = AsyncMock()
    return db


class TestUpsertAccountInsert:
    async def test_access_token_is_encrypted_on_insert(self):
        db = _mock_db_session(found=None)
        plaintext = "my-real-access-token"

        acct = await upsert_account(
            db,
            tenant_id=uuid.uuid4(),
            platform=SocialPlatform.linkedin,
            account_id="member-123",
            name="Test User",
            access_token=plaintext,
        )
        # The raw stored value must NOT equal the plaintext.
        assert acct.access_token_encrypted != plaintext
        assert acct.access_token_encrypted.startswith(_CIPHERTEXT_PREFIX)
        # But decryption round-trips.
        assert get_access_token(acct) == plaintext

    async def test_refresh_token_is_encrypted_on_insert(self):
        db = _mock_db_session(found=None)

        acct = await upsert_account(
            db,
            tenant_id=uuid.uuid4(),
            platform=SocialPlatform.linkedin,
            account_id="m1",
            name="X",
            access_token="at",
            refresh_token="my-refresh-token-xyz",
        )
        assert acct.refresh_token_encrypted is not None
        assert acct.refresh_token_encrypted != "my-refresh-token-xyz"
        assert acct.refresh_token_encrypted.startswith(_CIPHERTEXT_PREFIX)
        assert get_refresh_token(acct) == "my-refresh-token-xyz"

    async def test_expires_at_is_persisted(self):
        db = _mock_db_session(found=None)
        exp = datetime.now(timezone.utc) + timedelta(days=60)

        acct = await upsert_account(
            db,
            tenant_id=uuid.uuid4(),
            platform=SocialPlatform.linkedin,
            account_id="m1",
            name="X",
            access_token="at",
            expires_at=exp,
        )
        assert acct.token_expires_at == exp

    async def test_refresh_token_none_means_no_field_set(self):
        """Connectors that don't return a refresh token shouldn't leave garbage in the column."""
        db = _mock_db_session(found=None)
        acct = await upsert_account(
            db,
            tenant_id=uuid.uuid4(),
            platform=SocialPlatform.facebook,
            account_id="p1",
            name="Page",
            access_token="at",
            refresh_token=None,
        )
        assert acct.refresh_token_encrypted is None


class TestUpsertAccountUpdate:
    async def test_update_overwrites_access_token(self):
        existing = SocialAccount(
            id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            platform=SocialPlatform.linkedin,
            account_id="m1",
            name="old",
            access_token_encrypted="stale",
            refresh_token_encrypted="old-refresh",
            is_active=True,
        )
        db = _mock_db_session(found=existing)

        await upsert_account(
            db,
            tenant_id=existing.tenant_id,
            platform=existing.platform,
            account_id=existing.account_id,
            name="updated",
            access_token="new-access",
        )

        assert existing.access_token_encrypted != "stale"
        assert existing.access_token_encrypted.startswith(_CIPHERTEXT_PREFIX)
        # When refresh_token is None on update, existing refresh stays intact.
        assert existing.refresh_token_encrypted == "old-refresh"
        assert existing.name == "updated"
        assert existing.is_active is True

    async def test_update_only_rotates_refresh_when_new_one_given(self):
        existing = SocialAccount(
            id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            platform=SocialPlatform.linkedin,
            account_id="m1",
            name="n",
            access_token_encrypted="old",
            refresh_token_encrypted="old-refresh-ciphertext",
            is_active=True,
        )
        db = _mock_db_session(found=existing)

        await upsert_account(
            db,
            tenant_id=existing.tenant_id,
            platform=existing.platform,
            account_id=existing.account_id,
            name="n",
            access_token="new",
            refresh_token="new-refresh",
        )
        assert existing.refresh_token_encrypted != "old-refresh-ciphertext"
        assert existing.refresh_token_encrypted != "new-refresh"
        assert existing.refresh_token_encrypted.startswith(_CIPHERTEXT_PREFIX)


class TestGetAccessTokenBackwardCompat:
    def test_plaintext_legacy_token_still_readable(self):
        acct = SocialAccount(
            id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            platform=SocialPlatform.facebook,
            account_id="p1",
            name="Page",
            access_token_encrypted="EAAlegacyplaintexttoken",
            is_active=True,
        )
        assert get_access_token(acct) == "EAAlegacyplaintexttoken"

    def test_none_access_token_returns_none(self):
        acct = SocialAccount(
            id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            platform=SocialPlatform.facebook,
            account_id="p1",
            name="Page",
            access_token_encrypted=None,
            is_active=True,
        )
        assert get_access_token(acct) is None

    def test_missing_refresh_column_returns_none(self):
        """Defensive: if a connector pulls SocialAccount from a tenant that
        predates the column, the column's value is None — not an AttributeError."""
        acct = SocialAccount(
            id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            platform=SocialPlatform.facebook,
            account_id="p1",
            name="Page",
            access_token_encrypted="x",
            refresh_token_encrypted=None,
            is_active=True,
        )
        assert get_refresh_token(acct) is None
