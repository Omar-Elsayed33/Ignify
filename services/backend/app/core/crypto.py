"""Symmetric encryption for sensitive tokens at rest (OAuth access/refresh tokens).

Key derivation:
  Fernet requires a 32-byte URL-safe base64-encoded key. We derive it from SECRET_KEY
  via SHA-256 so rotating SECRET_KEY rotates the effective encryption key.

Backward compatibility:
  `decrypt_token()` accepts both encrypted ciphertext and pre-migration plaintext tokens —
  if decryption fails and the input looks like a plain token, it is returned as-is. This
  lets us roll out encryption without a migration-time data rewrite; on the next successful
  refresh or re-auth, the token is re-stored encrypted.
"""
from __future__ import annotations

import base64
import hashlib
import logging
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    key_bytes = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(key_bytes))


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
        # Looks like ciphertext but doesn't decrypt — key rotated or data corrupt.
        logger.warning("decrypt_token: stored value looked like ciphertext but failed to decrypt")
        return None
