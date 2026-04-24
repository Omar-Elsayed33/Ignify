"""P2-2: Fernet key rotation via ENCRYPTION_KEY and ENCRYPTION_KEY_PREVIOUS.

Verifies:
- ENCRYPTION_KEY (new primary) is preferred over SECRET_KEY when set.
- ENCRYPTION_KEY_PREVIOUS decrypts old ciphertext but does not encrypt new.
- rotate_encryption() re-wraps values under the primary key.
- Missing ENCRYPTION_KEY falls back to SECRET_KEY (Phase 1 behaviour).
"""
from __future__ import annotations

import pytest

from app.core import crypto
from app.core.crypto import (
    _CIPHERTEXT_PREFIX,
    decrypt_token,
    encrypt_token,
    rotate_encryption,
)


pytestmark = pytest.mark.unit


@pytest.fixture(autouse=True)
def _reset_fernet_between_tests():
    """Ensure each test gets a fresh @lru_cache'd MultiFernet."""
    crypto._fernet.cache_clear()
    yield
    crypto._fernet.cache_clear()


def _set_keys(
    monkeypatch,
    *,
    secret_key: str | None = None,
    encryption_key: str | None = None,
    previous_keys: str | None = None,
):
    if secret_key is not None:
        monkeypatch.setattr(crypto.settings, "SECRET_KEY", secret_key)
    if encryption_key is not None:
        monkeypatch.setattr(crypto.settings, "ENCRYPTION_KEY", encryption_key)
    if previous_keys is None:
        monkeypatch.delenv("ENCRYPTION_KEY_PREVIOUS", raising=False)
    else:
        monkeypatch.setenv("ENCRYPTION_KEY_PREVIOUS", previous_keys)
    crypto._fernet.cache_clear()


class TestKeySelection:
    def test_uses_encryption_key_when_set(self, monkeypatch):
        _set_keys(monkeypatch, secret_key="x" * 64, encryption_key="y" * 64)

        ct = encrypt_token("secret-value")
        assert ct.startswith(_CIPHERTEXT_PREFIX)
        assert decrypt_token(ct) == "secret-value"

        # Changing SECRET_KEY alone must NOT affect decryption since we use
        # ENCRYPTION_KEY. Rotating JWT secret should never brick tokens.
        _set_keys(monkeypatch, secret_key="z" * 64, encryption_key="y" * 64)
        assert decrypt_token(ct) == "secret-value"

    def test_falls_back_to_secret_key_when_encryption_key_empty(self, monkeypatch):
        _set_keys(monkeypatch, secret_key="phase-1-secret-" + "a" * 40, encryption_key="")
        ct = encrypt_token("legacy-style-encryption")
        assert decrypt_token(ct) == "legacy-style-encryption"


class TestKeyRotation:
    def test_previous_key_can_decrypt_old_ciphertext(self, monkeypatch):
        old_key = "old-primary-" + "a" * 52
        new_key = "new-primary-" + "b" * 52

        # Step 1: encrypt under OLD primary.
        _set_keys(monkeypatch, secret_key="unused-" + "z" * 57, encryption_key=old_key)
        legacy_ct = encrypt_token("pre-rotation-token")

        # Step 2: operator rotates: new primary, old becomes previous.
        _set_keys(
            monkeypatch,
            secret_key="unused-" + "z" * 57,
            encryption_key=new_key,
            previous_keys=old_key,
        )

        # Old ciphertext still decrypts.
        assert decrypt_token(legacy_ct) == "pre-rotation-token"

        # New writes go under the new key.
        new_ct = encrypt_token("post-rotation-token")
        assert new_ct != legacy_ct
        assert decrypt_token(new_ct) == "post-rotation-token"

    def test_decrypt_fails_when_previous_key_missing(self, monkeypatch):
        """Sanity: proves the rotation test is actually exercising the
        previous-key path, not a no-op."""
        old_key = "old-primary-" + "a" * 52
        new_key = "new-primary-" + "b" * 52

        _set_keys(monkeypatch, secret_key="u-" + "z" * 62, encryption_key=old_key)
        legacy_ct = encrypt_token("pre-rotation-token")

        # Rotate WITHOUT configuring previous.
        _set_keys(
            monkeypatch,
            secret_key="u-" + "z" * 62,
            encryption_key=new_key,
            previous_keys=None,
        )
        # Without ENCRYPTION_KEY_PREVIOUS, old ciphertext cannot decrypt.
        assert decrypt_token(legacy_ct) is None

    def test_rotate_encryption_rewraps_under_new_primary(self, monkeypatch):
        old_key = "old-primary-" + "a" * 52
        new_key = "new-primary-" + "b" * 52

        _set_keys(monkeypatch, secret_key="u-" + "z" * 62, encryption_key=old_key)
        legacy_ct = encrypt_token("rotate-me")

        _set_keys(
            monkeypatch,
            secret_key="u-" + "z" * 62,
            encryption_key=new_key,
            previous_keys=old_key,
        )
        rotated_ct = rotate_encryption(legacy_ct)

        assert rotated_ct is not None
        assert rotated_ct != legacy_ct
        assert decrypt_token(rotated_ct) == "rotate-me"

        # After rotation, dropping the previous key should still allow decrypt
        # of the rotated ciphertext (it's under the primary now).
        _set_keys(
            monkeypatch,
            secret_key="u-" + "z" * 62,
            encryption_key=new_key,
            previous_keys=None,
        )
        assert decrypt_token(rotated_ct) == "rotate-me"

    def test_rotate_plaintext_returns_plaintext(self, monkeypatch):
        _set_keys(monkeypatch, secret_key="u-" + "z" * 62, encryption_key="k-" + "a" * 61)
        # Plaintext (legacy rows) pass through unchanged — the sweep script
        # owns the conversion, not the rotate helper.
        assert rotate_encryption("plaintext-legacy") == "plaintext-legacy"
        assert rotate_encryption(None) is None
        assert rotate_encryption("") == ""


class TestPhase1Compatibility:
    """Ensure Phase 1 tokens (encrypted under SECRET_KEY because ENCRYPTION_KEY
    was unset) still decrypt after the Phase 2 upgrade — even when a new
    ENCRYPTION_KEY is set, by placing the old SECRET_KEY in the previous list."""

    def test_phase1_ciphertext_readable_via_previous_keys(self, monkeypatch):
        phase1_secret = "phase1-deployment-secret-" + "x" * 40
        _set_keys(monkeypatch, secret_key=phase1_secret, encryption_key="")
        phase1_ct = encrypt_token("connected-before-rotation")

        # Phase 2 rollout: operator sets a distinct ENCRYPTION_KEY and records
        # the old SECRET_KEY as a previous key for decrypt compatibility.
        new_enc = "phase2-encryption-key-" + "y" * 43
        _set_keys(
            monkeypatch,
            secret_key="jwt-only-new-" + "z" * 51,
            encryption_key=new_enc,
            previous_keys=phase1_secret,
        )
        assert decrypt_token(phase1_ct) == "connected-before-rotation"
