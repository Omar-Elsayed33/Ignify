"""Codex audit fix — verify auth router + service use User.password_hash.

Regression guard: ensures nobody reintroduces the `hashed_password`
attribute name that doesn't exist on the User ORM model and caused
500s on change-password + account-deletion.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from app.core.security import hash_password, verify_password
from app.db.models import User


pytestmark = pytest.mark.unit


class TestUserModelField:
    def test_user_model_has_password_hash_not_hashed_password(self):
        # The ORM model attribute MUST be `password_hash` — anything else
        # means the auth router is referencing a non-existent column.
        assert hasattr(User, "password_hash")
        assert not hasattr(User, "hashed_password")


class TestAuthRouterNoHashedPassword:
    def test_router_uses_password_hash_only(self):
        router_path = Path(__file__).resolve().parents[2] / "app" / "modules" / "auth" / "router.py"
        src = router_path.read_text(encoding="utf-8")
        # `db_user.hashed_password` and `user.hashed_password` are the
        # patterns that broke the product. Guard against both.
        assert "db_user.hashed_password" not in src, (
            "auth/router.py references db_user.hashed_password — field is password_hash"
        )
        assert "user.hashed_password" not in src, (
            "auth/router.py references user.hashed_password — field is password_hash"
        )

    def test_service_uses_password_hash_only(self):
        service_path = Path(__file__).resolve().parents[2] / "app" / "modules" / "auth" / "service.py"
        src = service_path.read_text(encoding="utf-8")
        assert ".hashed_password" not in src, (
            "auth/service.py references .hashed_password — field is password_hash"
        )


class TestPasswordVerifyContract:
    """The security helpers use `hashed_password` as a PARAMETER NAME (local
    variable). That is fine — the bug was only on the ORM-attribute reads/writes.
    This test documents the contract so future changes don't misinterpret."""

    def test_hash_and_verify_roundtrip(self):
        raw = "Launch12345!"
        hashed = hash_password(raw)
        assert hashed != raw
        assert verify_password(raw, hashed) is True

    def test_wrong_password_rejected(self):
        hashed = hash_password("correct-password")
        assert verify_password("wrong-password", hashed) is False

    def test_empty_password_rejected(self):
        hashed = hash_password("something")
        assert verify_password("", hashed) is False
