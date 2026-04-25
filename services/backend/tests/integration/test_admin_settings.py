"""Phase 12: admin-managed platform settings (OPENROUTER_MANAGER_KEY etc.)

Verifies:
- get/set roundtrip preserves the plaintext value
- secret-marked values are encrypted on disk (raw stored value != plaintext)
- get_setting_status never returns the plaintext
- DB-stored value takes priority over env var in get_manager_key_async
"""
from __future__ import annotations

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.admin_settings import (
    KEY_OPENROUTER_MANAGER,
    get_setting,
    get_setting_status,
    set_setting,
)
from app.core.config import settings
from app.core.crypto import _CIPHERTEXT_PREFIX
from app.db.models import AdminSetting


pytestmark = [pytest.mark.integration, pytest.mark.asyncio]


@pytest.fixture
async def session() -> AsyncSession:
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool, echo=False)
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        async with maker() as s:
            yield s
    finally:
        await engine.dispose()


@pytest.fixture(autouse=True)
async def clean_admin_settings(session):
    """Ensure each test starts with no rows for the keys it touches."""
    await session.execute(
        text("DELETE FROM admin_settings WHERE key LIKE 'openrouter.%' OR key LIKE 'pytest.%'")
    )
    await session.commit()
    yield
    await session.execute(
        text("DELETE FROM admin_settings WHERE key LIKE 'openrouter.%' OR key LIKE 'pytest.%'")
    )
    await session.commit()


class TestSetGetRoundtrip:
    async def test_set_and_get_secret(self, session):
        await set_setting(session, KEY_OPENROUTER_MANAGER, "sk-or-test-12345")
        await session.commit()
        retrieved = await get_setting(session, KEY_OPENROUTER_MANAGER)
        assert retrieved == "sk-or-test-12345"

    async def test_unset_returns_none(self, session):
        result = await get_setting(session, "pytest.never-set")
        assert result is None

    async def test_set_to_empty_clears(self, session):
        await set_setting(session, KEY_OPENROUTER_MANAGER, "first-value")
        await session.commit()
        await set_setting(session, KEY_OPENROUTER_MANAGER, "")
        await session.commit()
        assert await get_setting(session, KEY_OPENROUTER_MANAGER) is None

    async def test_set_to_none_clears(self, session):
        await set_setting(session, KEY_OPENROUTER_MANAGER, "value")
        await session.commit()
        await set_setting(session, KEY_OPENROUTER_MANAGER, None)
        await session.commit()
        assert await get_setting(session, KEY_OPENROUTER_MANAGER) is None


class TestEncryptionAtRest:
    async def test_secret_value_is_encrypted_in_db(self, session):
        plaintext = "sk-or-this-must-not-appear-in-db"
        await set_setting(session, KEY_OPENROUTER_MANAGER, plaintext, is_secret=True)
        await session.commit()

        # Read the RAW row and confirm value is not the plaintext.
        row = (await session.execute(
            select(AdminSetting).where(AdminSetting.key == KEY_OPENROUTER_MANAGER)
        )).scalar_one()
        assert row.value != plaintext
        assert row.value.startswith(_CIPHERTEXT_PREFIX)

    async def test_non_secret_value_stored_plaintext(self, session):
        # Non-secret settings (e.g. support phone, app version) skip encryption.
        await set_setting(session, "pytest.public-flag", "yes", is_secret=False)
        await session.commit()
        row = (await session.execute(
            select(AdminSetting).where(AdminSetting.key == "pytest.public-flag")
        )).scalar_one()
        assert row.value == "yes"
        assert row.is_secret is False


class TestStatusEndpoint:
    async def test_status_never_returns_value(self, session):
        await set_setting(session, KEY_OPENROUTER_MANAGER, "sk-or-secret-value")
        await session.commit()
        status = await get_setting_status(session, KEY_OPENROUTER_MANAGER)
        # The contract: status returns metadata only, never the secret.
        assert status["configured"] is True
        assert "value" not in status
        assert "sk-or-secret-value" not in str(status)

    async def test_status_unset(self, session):
        status = await get_setting_status(session, "pytest.never-set")
        assert status == {
            "key": "pytest.never-set",
            "configured": False,
            "is_secret": True,
            "updated_at": None,
        }


class TestManagerKeyResolution:
    async def test_db_takes_priority_over_env(self, session, monkeypatch):
        from app.core.openrouter_provisioning import get_manager_key_async

        # Set env-var fallback to one value, DB to another. DB should win.
        monkeypatch.setattr(
            "app.core.openrouter_provisioning.settings",
            type("S", (), {
                "OPENROUTER_MANAGER_KEY": "env-fallback-value",
                "OPENROUTER_API_KEY": "env-api-key",
            })(),
        )
        await set_setting(session, KEY_OPENROUTER_MANAGER, "db-stored-value")
        await session.commit()

        result = await get_manager_key_async(session)
        assert result == "db-stored-value"

    async def test_env_used_when_db_unset(self, session, monkeypatch):
        from app.core.openrouter_provisioning import get_manager_key_async

        monkeypatch.setattr(
            "app.core.openrouter_provisioning.settings",
            type("S", (), {
                "OPENROUTER_MANAGER_KEY": "env-fallback-value",
                "OPENROUTER_API_KEY": "env-api-key",
            })(),
        )
        result = await get_manager_key_async(session)
        assert result == "env-fallback-value"
