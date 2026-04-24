"""Shared pytest fixtures for Ignify backend tests.

Fixture philosophy:
- Unit tests should run in < 10ms, no DB/Redis required.
- Integration tests opt in via the `integration` marker and get real fixtures.
- Redis is faked via `fakeredis` by default; integration tests can override to real Redis.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Make `app.*` importable when running `pytest` from `services/backend/`.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Ensure deterministic SECRET_KEY for every test so Fernet key is stable.
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-unit-tests-do-not-use-in-prod-" + "x" * 16)
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://ignify:ignify_dev_2024@localhost:5432/ignify")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/15")  # DB 15 reserved for tests
os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("OPENROUTER_API_KEY", "test-openrouter-key")

import pytest


@pytest.fixture
def fake_redis():
    """In-process Redis substitute — no network, no shared state across tests."""
    import fakeredis
    return fakeredis.FakeRedis(decode_responses=True)


@pytest.fixture
def async_fake_redis():
    """Async fakeredis (for code that uses `redis.asyncio`)."""
    import fakeredis.aioredis
    return fakeredis.aioredis.FakeRedis(decode_responses=True)


@pytest.fixture(autouse=True)
def _reset_fernet_cache():
    """Clear the lru_cache on `_fernet()` between tests so SECRET_KEY changes take effect."""
    yield
    try:
        from app.core.crypto import _fernet
        _fernet.cache_clear()
    except ImportError:
        pass
