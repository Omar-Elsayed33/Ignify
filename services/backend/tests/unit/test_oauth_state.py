"""P1-2: Redis-backed OAuth state store.

Verifies the module survives what an in-memory dict could not:
- Data persists across "process restarts" (simulated by reaching through to the
  same Redis instance from a fresh import).
- TTL expiry works.
- Replay is impossible — `pop()` is one-shot.
- Redis unavailability fails closed on reads and fails loud on issue.
"""
from __future__ import annotations

import json
import uuid
from unittest.mock import patch

import fakeredis
import pytest
from redis.exceptions import ConnectionError as RedisConnError

from app.integrations.social import oauth_state


pytestmark = pytest.mark.unit


@pytest.fixture(autouse=True)
def _use_fake_redis(monkeypatch):
    """Swap the real Redis client for a fakeredis instance per test."""
    fake = fakeredis.FakeRedis(decode_responses=True)
    oauth_state._reset_client_for_tests()
    monkeypatch.setattr(oauth_state, "_client", lambda: fake)
    yield fake
    oauth_state._reset_client_for_tests()


class TestIssue:
    def test_returns_opaque_token(self, _use_fake_redis):
        tid = uuid.uuid4()
        state = oauth_state.issue(tid, "facebook")
        assert isinstance(state, str)
        assert len(state) >= 32  # secrets.token_urlsafe(32) → ~43 chars
        # Token stored in Redis under the prefix
        assert _use_fake_redis.get(oauth_state._KEY_PREFIX + state) is not None

    def test_payload_contains_tenant_and_platform(self, _use_fake_redis):
        tid = uuid.uuid4()
        state = oauth_state.issue(tid, "linkedin")
        raw = _use_fake_redis.get(oauth_state._KEY_PREFIX + state)
        data = json.loads(raw)
        assert data["tenant_id"] == str(tid)
        assert data["platform"] == "linkedin"
        assert data["extra"] == {}

    def test_extra_is_persisted(self, _use_fake_redis):
        tid = uuid.uuid4()
        state = oauth_state.issue(tid, "x", extra={"prompt": "consent"})
        raw = _use_fake_redis.get(oauth_state._KEY_PREFIX + state)
        data = json.loads(raw)
        assert data["extra"] == {"prompt": "consent"}

    def test_ttl_is_set(self, _use_fake_redis):
        tid = uuid.uuid4()
        state = oauth_state.issue(tid, "facebook")
        ttl = _use_fake_redis.ttl(oauth_state._KEY_PREFIX + state)
        assert 0 < ttl <= oauth_state._STATE_TTL_SECONDS

    def test_each_call_returns_a_unique_token(self, _use_fake_redis):
        tid = uuid.uuid4()
        a = oauth_state.issue(tid, "facebook")
        b = oauth_state.issue(tid, "facebook")
        assert a != b


class TestPop:
    def test_valid_state_returns_record_and_deletes(self, _use_fake_redis):
        tid = uuid.uuid4()
        state = oauth_state.issue(tid, "facebook", extra={"foo": "bar"})
        result = oauth_state.pop(state)
        assert result is not None
        assert result["tenant_id"] == str(tid)
        assert result["platform"] == "facebook"
        assert result["extra"] == {"foo": "bar"}
        # One-shot: second pop returns None (replay protection).
        assert oauth_state.pop(state) is None

    def test_unknown_state_returns_none(self, _use_fake_redis):
        assert oauth_state.pop("never-issued-state-token") is None

    def test_empty_string_returns_none(self, _use_fake_redis):
        assert oauth_state.pop("") is None

    def test_expired_state_returns_none(self, _use_fake_redis):
        tid = uuid.uuid4()
        state = oauth_state.issue(tid, "facebook")
        # Force-expire: delete the key (equivalent to TTL expiry from the pop side).
        _use_fake_redis.delete(oauth_state._KEY_PREFIX + state)
        assert oauth_state.pop(state) is None

    def test_corrupt_payload_returns_none_not_raises(self, _use_fake_redis):
        # Simulate a partial write or rogue actor writing garbage under the key.
        _use_fake_redis.set(oauth_state._KEY_PREFIX + "bad-state", "not-json", ex=60)
        assert oauth_state.pop("bad-state") is None


class TestSurvivesProcessRestart:
    """The whole point of moving off an in-memory dict: state lives in Redis,
    so a new "process" (simulated by clearing the module-global client cache)
    still sees the record."""

    def test_state_issued_then_readable_after_client_reset(self, _use_fake_redis):
        tid = uuid.uuid4()
        state = oauth_state.issue(tid, "facebook")

        # Simulate a deploy restart: reset the module's cached client. In an
        # in-memory implementation, this would wipe the state. With Redis, the
        # same fakeredis instance (passed via fixture) still holds the record.
        oauth_state._reset_client_for_tests()

        # Re-bind the fake after reset (the fixture is still in scope).
        import fakeredis as _fr  # noqa: PLC0415
        # Note: in a real deploy both replicas would connect to the same Redis
        # endpoint; the test simulates that by keeping the same fakeredis ref.
        with patch.object(oauth_state, "_client", return_value=_use_fake_redis):
            result = oauth_state.pop(state)
        assert result is not None
        assert result["tenant_id"] == str(tid)


class TestFailureModes:
    def test_issue_raises_when_redis_unreachable(self, monkeypatch):
        class _BrokenRedis:
            def set(self, *a, **kw):
                raise RedisConnError("cannot reach redis")

        monkeypatch.setattr(oauth_state, "_client", lambda: _BrokenRedis())
        with pytest.raises(RuntimeError, match="unavailable"):
            oauth_state.issue(uuid.uuid4(), "facebook")

    def test_pop_returns_none_when_redis_unreachable(self, monkeypatch):
        class _BrokenRedis:
            def getdel(self, *a, **kw):
                raise RedisConnError("cannot reach redis")

        monkeypatch.setattr(oauth_state, "_client", lambda: _BrokenRedis())
        # Pop must fail closed — unknown state is indistinguishable from
        # a Redis error from the caller's perspective, which is the safe default.
        assert oauth_state.pop("any-state") is None
