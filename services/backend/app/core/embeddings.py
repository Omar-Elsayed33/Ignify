"""Text embeddings gateway.

Primary path: OpenAI text-embedding-3-small via OpenRouter. If OpenRouter does
not proxy embeddings for the configured key we fall back to calling OpenAI
directly when ``settings.OPENAI_API_KEY`` is set. If neither is configured we
emit deterministic hash-based pseudo-embeddings so tests and local dev keep
working without network access.

All vectors are 1536-dim to match ``text-embedding-3-small`` and the
``pgvector.Vector(1536)`` column on ``knowledge_chunks``.
"""
from __future__ import annotations

import hashlib
import logging
import math
from typing import Iterable

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

EMBEDDING_DIM = 1536
EMBEDDING_MODEL = "openai/text-embedding-3-small"
_OPENAI_MODEL = "text-embedding-3-small"
_BATCH_SIZE = 100


def _hash_embedding(text: str) -> list[float]:
    """Deterministic fallback — NOT semantically meaningful, but stable.

    Produces an L2-normalized 1536-d vector derived from SHA256 of the text,
    expanded by repeatedly hashing with an index suffix. Lets tests exercise
    the vector-search code path without requiring a live embeddings endpoint.
    """
    data = text.encode("utf-8", errors="ignore")
    out: list[float] = []
    counter = 0
    while len(out) < EMBEDDING_DIM:
        h = hashlib.sha256(data + counter.to_bytes(4, "big")).digest()
        for i in range(0, len(h), 2):
            if len(out) >= EMBEDDING_DIM:
                break
            val = int.from_bytes(h[i : i + 2], "big") / 65535.0
            out.append(val * 2.0 - 1.0)  # map [0,1] → [-1,1]
        counter += 1
    # L2 normalize
    norm = math.sqrt(sum(v * v for v in out)) or 1.0
    return [v / norm for v in out]


async def _call_openrouter(texts: list[str]) -> list[list[float]] | None:
    if not settings.OPENROUTER_API_KEY:
        return None
    url = f"{settings.OPENROUTER_BASE_URL.rstrip('/')}/embeddings"
    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": getattr(settings, "OPENROUTER_SITE_URL", "") or "",
        "X-Title": getattr(settings, "OPENROUTER_APP_NAME", "") or "Ignify",
    }
    payload = {"model": EMBEDDING_MODEL, "input": texts}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code >= 400:
                logger.warning(
                    "embeddings: openrouter returned %s — %s",
                    resp.status_code,
                    resp.text[:200],
                )
                return None
            data = resp.json()
            items = data.get("data") or []
            vectors = [it.get("embedding") for it in items]
            if not vectors or any(v is None for v in vectors):
                return None
            return vectors
    except Exception as e:  # noqa: BLE001
        logger.warning("embeddings: openrouter error %s", e)
        return None


async def _call_openai_direct(texts: list[str]) -> list[list[float]] | None:
    key = getattr(settings, "OPENAI_API_KEY", "") or ""
    if not key:
        return None
    url = "https://api.openai.com/v1/embeddings"
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    payload = {"model": _OPENAI_MODEL, "input": texts}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return [it["embedding"] for it in data.get("data", [])]
    except Exception as e:  # noqa: BLE001
        logger.warning("embeddings: openai direct error %s", e)
        return None


def _chunked(items: list[str], size: int) -> Iterable[list[str]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


async def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed a list of texts, returning one vector per input (order preserved)."""
    if not texts:
        return []
    results: list[list[float]] = []
    for batch in _chunked(texts, _BATCH_SIZE):
        vectors = await _call_openrouter(batch)
        if vectors is None:
            vectors = await _call_openai_direct(batch)
        if vectors is None:
            vectors = [_hash_embedding(t) for t in batch]
        # Defensive: pad/truncate any oddly-sized vectors to EMBEDDING_DIM
        fixed: list[list[float]] = []
        for v in vectors:
            if len(v) == EMBEDDING_DIM:
                fixed.append(list(v))
            elif len(v) > EMBEDDING_DIM:
                fixed.append(list(v[:EMBEDDING_DIM]))
            else:
                fixed.append(list(v) + [0.0] * (EMBEDDING_DIM - len(v)))
        results.extend(fixed)
    return results


async def embed_text(text: str) -> list[float]:
    vectors = await embed_batch([text or ""])
    return vectors[0]
