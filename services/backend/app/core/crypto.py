"""Symmetric encryption for sensitive tokens at rest (OAuth access/refresh tokens).

Key derivation (Phase 2 update):
  The encryption key is derived from `settings.ENCRYPTION_KEY` when set (preferred),
  falling back to `settings.SECRET_KEY` for backward compatibility with Phase 1.
  Separating the two lets ops rotate SECRET_KEY (which only signs JWTs and
  invalidates sessions) without having to decrypt-and-re-encrypt every stored
  token. If you later need to rotate the encryption key itself, set
  `ENCRYPTION_KEY_PREVIOUS` to the old value — `decrypt_token()` will try the
  previous key if the current one fails, and the next write will use the new
  key (MultiFernet-style).

Backward compatibility:
  `decrypt_token()` accepts both encrypted ciphertext and pre-migration plaintext tokens —
  if decryption fails and the input looks like a plain token, it is returned as-is. This
  lets us roll out encryption without a migration-time data rewrite; on the next successful
  refresh or re-auth, the token is re-stored encrypted with the current key.
"""
from __future__ import annotations

import base64
import hashlib
import logging
import os
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from app.core.config import settings

logger = logging.getLogger(__name__)


def _derive_fernet_key(source: str) -> bytes:
    """Turn an arbitrary-length secret into a 32-byte URL-safe base64 Fernet key."""
    return base64.urlsafe_b64encode(hashlib.sha256(source.encode("utf-8")).digest())


@lru_cache(maxsize=1)
def _fernet() -> MultiFernet:
    """Build a MultiFernet that encrypts with the current key and can decrypt
    with any of the current + previous keys.

    Key selection order (highest priority first):
    1. `ENCRYPTION_KEY` (new in Phase 2) — the primary encryption key.
    2. `SECRET_KEY` — used when `ENCRYPTION_KEY` is unset, preserving Phase 1
       semantics so existing deployments don't need a config change.

    Optional previous keys (for rotation):
    - `ENCRYPTION_KEY_PREVIOUS` — comma-separated list of old keys. They can
      decrypt existing ciphertext but are never used to encrypt new writes.
    """
    primary_source = getattr(settings, "ENCRYPTION_KEY", "") or settings.SECRET_KEY
    if not primary_source:
        # Shouldn't happen — production config validation requires SECRET_KEY.
        # Fail loud so this surfaces during dev instead of at first token write.
        raise RuntimeError(
            "No encryption key available: both ENCRYPTION_KEY and SECRET_KEY are empty"
        )

    primary = Fernet(_derive_fernet_key(primary_source))

    # Previous keys come from env directly so tests can swap them via monkeypatch
    # without needing to mutate Settings. Comma-separated list.
    previous_raw = os.environ.get("ENCRYPTION_KEY_PREVIOUS", "").strip()
    previous_keys = [
        Fernet(_derive_fernet_key(k.strip()))
        for k in previous_raw.split(",")
        if k.strip()
    ]
    return MultiFernet([primary, *previous_keys])


# Fernet ciphertexts always start with this version byte (b'\x80') after URL-safe
# base64 decoding, and always begin with "gAAAAA" when encoded. We use the prefix
# as a cheap discriminator to distinguish pre-migration plaintext from ciphertext.
_CIPHERTEXT_PREFIX = "gAAAAA"


def encrypt_token(plaintext: str | None) -> str | None:
    if plaintext is None or plaintext == "":
        return plaintext
    if plaintext.startswith(_CIPHERTEXT_PREFIX):
        # Already encrypted — avoid double-encryption if a caller passes through.
        return plaintext
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt_token(stored: str | None) -> str | None:
    if stored is None or stored == "":
        return stored
    if not stored.startswith(_CIPHERTEXT_PREFIX):
        # Pre-migration plaintext row — return as-is; will be re-stored encrypted on next refresh.
        return stored
    try:
        return _fernet().decrypt(stored.encode("ascii")).decode("utf-8")
    except InvalidToken:
        # Looks like ciphertext but no current or previous key can decrypt it.
        # This means the ciphertext is corrupt OR the operator rotated keys
        # without configuring ENCRYPTION_KEY_PREVIOUS — in which case they must
        # re-OAuth to unstick the account.
        logger.warning(
            "decrypt_token: stored value looked like ciphertext but failed to decrypt "
            "under the current or any previous key"
        )
        return None


def rotate_encryption(stored: str | None) -> str | None:
    """Re-encrypt a stored value with the current primary key.

    Use for opportunistic rotation: when we read a token and want to migrate it
    from a previous key to the current one. Returns the value unchanged if
    already encrypted with the current key, or None on decrypt failure.
    """
    if stored is None or stored == "":
        return stored
    if not stored.startswith(_CIPHERTEXT_PREFIX):
        # Plaintext — let the existing sweep/upsert path encrypt it.
        return stored
    try:
        # MultiFernet.rotate() re-encrypts under the primary key if needed and
        # returns the value unchanged if it's already under the primary.
        return _fernet().rotate(stored.encode("ascii")).decode("ascii")
    except InvalidToken:
        logger.warning("rotate_encryption: could not decrypt under any known key")
        return None
