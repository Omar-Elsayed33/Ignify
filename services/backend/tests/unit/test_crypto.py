"""P1-1: Unit tests for core.crypto — Fernet-based token encryption at rest.

Covers:
- encrypt_token() produces ciphertext (≠ plaintext).
- decrypt_token(encrypt_token(x)) == x (round-trip).
- Encryption is idempotent (re-encrypting ciphertext returns the same ciphertext).
- Pre-migration plaintext is returned as-is by decrypt_token() (backward compat).
- None / empty strings pass through.
- Tampered ciphertext returns None and logs a warning.
"""
from __future__ import annotations

import pytest

from app.core.crypto import _CIPHERTEXT_PREFIX, decrypt_token, encrypt_token


pytestmark = pytest.mark.unit


class TestEncryptToken:
    def test_produces_ciphertext_different_from_plaintext(self):
        plaintext = "my-oauth-access-token-abc123"
        ct = encrypt_token(plaintext)
        assert ct is not None
        assert ct != plaintext
        assert ct.startswith(_CIPHERTEXT_PREFIX)

    def test_roundtrip(self):
        plaintext = "EAAGm0PXmRmEBO..."
        assert decrypt_token(encrypt_token(plaintext)) == plaintext

    def test_idempotent_on_already_encrypted_string(self):
        ct = encrypt_token("secret")
        # Passing ciphertext back through encrypt_token MUST return it unchanged,
        # not re-encrypt (which would double-wrap and make decrypt_token fail).
        assert encrypt_token(ct) == ct

    def test_none_passes_through(self):
        assert encrypt_token(None) is None

    def test_empty_string_passes_through(self):
        assert encrypt_token("") == ""

    def test_long_token_supported(self):
        # LinkedIn tokens can be 800+ chars; Meta long-lived ~220; ensure no length truncation.
        plaintext = "x" * 1500
        ct = encrypt_token(plaintext)
        assert decrypt_token(ct) == plaintext

    def test_unicode_token_supported(self):
        plaintext = "تجربة-token-‮"
        assert decrypt_token(encrypt_token(plaintext)) == plaintext


class TestDecryptToken:
    def test_plaintext_pre_migration_returned_as_is(self):
        # Tokens stored before encryption was enabled do not start with gAAAAA.
        # decrypt_token() must return them unchanged for backward compatibility.
        plaintext = "EAAGm0-legacy-plaintext-token"
        assert not plaintext.startswith(_CIPHERTEXT_PREFIX)
        assert decrypt_token(plaintext) == plaintext

    def test_none_passes_through(self):
        assert decrypt_token(None) is None

    def test_empty_string_passes_through(self):
        assert decrypt_token("") == ""

    def test_tampered_ciphertext_returns_none(self):
        ct = encrypt_token("secret")
        # Truncate the ciphertext — still starts with gAAAAA but won't decrypt.
        tampered = ct[:-10] + "corrupted!"
        assert tampered.startswith(_CIPHERTEXT_PREFIX)
        # Must return None (not raise) so callers handle gracefully.
        assert decrypt_token(tampered) is None


class TestEncryptedStorageInvariant:
    """The contract we rely on for P1-1: any value persisted to a token column
    must round-trip through encrypt → decrypt and must NOT equal the plaintext."""

    @pytest.mark.parametrize("plaintext", [
        "abc",
        "ya29.A0AfH6SMBx" + "z" * 200,  # Google-style access token
        "1//09a7fake-refresh",              # Google refresh token
        "EAAGm0PXmRmEBO" + "x" * 150,       # Meta access token
        "AQVLkU-fake-linkedin" + "y" * 400, # LinkedIn token
    ])
    def test_storage_shape(self, plaintext):
        stored = encrypt_token(plaintext)
        assert stored != plaintext
        assert stored.startswith(_CIPHERTEXT_PREFIX)
        assert decrypt_token(stored) == plaintext
