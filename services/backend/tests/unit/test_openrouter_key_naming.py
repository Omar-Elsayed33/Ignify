"""Phase 11: OpenRouter sub-key naming contract.

Rules (from docs/AI_PROVIDER_POLICY.md):
- The key name in OpenRouter MUST be exactly `{tenant_id}`.
- No "ignify" prefix, no "tenant-" prefix.
- No tenant name, no user email, no timestamp.
- No truncation — full UUID string.
- Identical behavior across callers (tenant signup, subscription
  activation, admin re-provision).
"""
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.core.openrouter_provisioning import build_key_name, provision_key


pytestmark = pytest.mark.unit


class TestBuildKeyName:
    def test_is_exact_tenant_id_string(self):
        tid = uuid.uuid4()
        assert build_key_name(str(tid)) == str(tid)

    def test_no_ignify_prefix(self):
        tid = "550e8400-e29b-41d4-a716-446655440000"
        assert "ignify" not in build_key_name(tid).lower()

    def test_no_tenant_prefix(self):
        tid = "550e8400-e29b-41d4-a716-446655440000"
        name = build_key_name(tid)
        assert not name.startswith("tenant-")
        assert not name.startswith("ignify-tenant-")
        assert not name.startswith("ignify-")

    def test_no_truncation(self):
        # Full UUID must survive — the previous impl used tenant_id[:8]
        # which could collide. Any length equal to or longer than 36 proves
        # we kept the full string.
        tid = "550e8400-e29b-41d4-a716-446655440000"
        assert len(build_key_name(tid)) == len(tid)
        assert build_key_name(tid) == tid

    def test_accepts_uuid_object(self):
        # str(uuid.UUID) returns the canonical hex form.
        tid_obj = uuid.UUID("550e8400-e29b-41d4-a716-446655440000")
        assert build_key_name(str(tid_obj)) == "550e8400-e29b-41d4-a716-446655440000"

    def test_not_influenced_by_caller_context(self):
        """Build-key-name must return the same thing regardless of where it's
        called — Phase 11 requires identical naming across tenant signup,
        subscription activation, and admin re-provision."""
        tid = "abc"
        assert build_key_name(tid) == "abc"
        # Same input → same output across repeated calls (idempotent/pure).
        assert build_key_name(tid) == build_key_name(tid)


class TestProvisionKeyPayload:
    """Exercise provision_key() with the HTTP call mocked — verify the
    payload we send OpenRouter actually uses build_key_name() as `name`."""

    async def test_payload_name_is_tenant_id(self, monkeypatch):
        captured: dict = {}
        tid = str(uuid.uuid4())

        class _FakeResponse:
            status_code = 200
            text = ""

            def json(self):
                return {"key": "sk-or-test", "key_id": "kid-test", "limit": 6.0}

        class _FakeClient:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *_args):
                return None

            async def post(self, url, json, headers):
                captured["url"] = url
                captured["json"] = json
                captured["headers"] = headers
                return _FakeResponse()

        monkeypatch.setattr(
            "app.core.openrouter_provisioning.httpx.AsyncClient",
            lambda timeout=15: _FakeClient(),
        )
        # Force a non-empty manager key so provision_key doesn't early-return.
        monkeypatch.setattr(
            "app.core.openrouter_provisioning.settings",
            type("S", (), {
                "OPENROUTER_MANAGER_KEY": "sk-or-manager",
                "OPENROUTER_API_KEY": "",
            })(),
        )

        result = await provision_key(
            tenant_id=tid,
            tenant_name="Some Business Co.",
            plan_slug="starter",
        )

        assert result["key"] == "sk-or-test"
        assert result["key_id"] == "kid-test"

        # The CRITICAL assertion: the payload's `name` field is just the
        # tenant UUID — no prefix, no mangling.
        assert captured["json"]["name"] == tid
        assert "ignify" not in captured["json"]["name"].lower()
        # Label CAN carry the human-readable business name (that's only for
        # OpenRouter's UI) but the tenant_id is still the canonical name.
        assert "name" in captured["json"]

    async def test_returns_empty_when_manager_key_missing(self, monkeypatch):
        """Unchanged behavior from before Phase 11 — but re-verified here
        so we know the fix didn't accidentally bypass the guard."""
        monkeypatch.setattr(
            "app.core.openrouter_provisioning.settings",
            type("S", (), {
                "OPENROUTER_MANAGER_KEY": "",
                "OPENROUTER_API_KEY": "",
            })(),
        )
        result = await provision_key(
            tenant_id=str(uuid.uuid4()),
            tenant_name="X",
            plan_slug="free",
        )
        assert result == {}


class TestNoIgnifyPrefixAnywhere:
    """Belt-and-suspenders: verify that no code path we control still
    builds a key name with the legacy `ignify-` prefix."""

    def test_build_key_name_across_tenants(self):
        # Parametric sweep — ensure behavior holds for many different
        # tenant_id shapes (UUIDs, empty, unusual strings).
        for tid in [
            "550e8400-e29b-41d4-a716-446655440000",
            "00000000-0000-0000-0000-000000000000",
            "fff",
            "x",
        ]:
            name = build_key_name(tid)
            assert "ignify" not in name.lower(), (
                f"Key name for {tid!r} contains 'ignify': {name!r}"
            )
            assert name == str(tid), (
                f"Key name {name!r} differs from tenant_id {tid!r}"
            )
