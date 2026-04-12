"""Knowledge base service — embedding + pgvector similarity search."""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.embeddings import embed_batch, embed_text
from app.db.models import KnowledgeChunk


def _to_response_dict(row: KnowledgeChunk) -> dict[str, Any]:
    return {
        "id": row.id,
        "tenant_id": row.tenant_id,
        "source": row.source,
        "title": row.title,
        "content": row.content,
        "metadata": row.metadata_ or {},
        "created_at": row.created_at,
    }


async def list_chunks(
    db: AsyncSession, tenant_id: uuid.UUID, limit: int = 500
) -> list[KnowledgeChunk]:
    result = await db.execute(
        select(KnowledgeChunk)
        .where(KnowledgeChunk.tenant_id == tenant_id)
        .order_by(KnowledgeChunk.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def create_chunk(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    title: str,
    content: str,
    source: str = "custom",
    metadata: dict[str, Any] | None = None,
) -> KnowledgeChunk:
    vec = await embed_text(f"{title}\n\n{content}")
    chunk = KnowledgeChunk(
        tenant_id=tenant_id,
        title=title,
        content=content,
        source=source,
        embedding=vec,
        metadata_=metadata or {},
    )
    db.add(chunk)
    await db.commit()
    await db.refresh(chunk)
    return chunk


async def bulk_create(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    items: list[dict[str, Any]],
) -> int:
    if not items:
        return 0
    texts = [f"{it['title']}\n\n{it['content']}" for it in items]
    vectors = await embed_batch(texts)
    for it, vec in zip(items, vectors):
        db.add(
            KnowledgeChunk(
                tenant_id=tenant_id,
                title=it["title"],
                content=it["content"],
                source=it.get("source") or "custom",
                embedding=vec,
                metadata_=it.get("metadata") or {},
            )
        )
    await db.commit()
    return len(items)


async def delete_chunk(
    db: AsyncSession, tenant_id: uuid.UUID, chunk_id: uuid.UUID
) -> bool:
    result = await db.execute(
        delete(KnowledgeChunk).where(
            KnowledgeChunk.id == chunk_id,
            KnowledgeChunk.tenant_id == tenant_id,
        )
    )
    await db.commit()
    return (result.rowcount or 0) > 0


async def update_chunk(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    chunk_id: uuid.UUID,
    patch: dict[str, Any],
) -> KnowledgeChunk | None:
    result = await db.execute(
        select(KnowledgeChunk).where(
            KnowledgeChunk.id == chunk_id,
            KnowledgeChunk.tenant_id == tenant_id,
        )
    )
    chunk = result.scalar_one_or_none()
    if not chunk:
        return None
    title_changed = "title" in patch and patch["title"] is not None
    content_changed = "content" in patch and patch["content"] is not None
    for k, v in patch.items():
        if v is None:
            continue
        if k == "metadata":
            chunk.metadata_ = v
        else:
            setattr(chunk, k, v)
    if title_changed or content_changed:
        chunk.embedding = await embed_text(f"{chunk.title}\n\n{chunk.content}")
    await db.commit()
    await db.refresh(chunk)
    return chunk


async def search(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    query: str,
    top_k: int = 5,
) -> list[tuple[KnowledgeChunk, float]]:
    """Cosine-similarity search via pgvector's ``<=>`` operator.

    Returns list of (chunk, score) where score = 1 - cosine_distance (higher is better).
    """
    qvec = await embed_text(query)
    # pgvector expects the literal like '[0.1,0.2,...]'. SQLAlchemy's `Vector`
    # type handles param binding for us when the column type is registered;
    # fall back to a raw SQL cast to be portable across dialect availability.
    literal = "[" + ",".join(f"{v:.6f}" for v in qvec) + "]"

    sql = text(
        """
        SELECT id, (embedding <=> (:qvec)::vector) AS distance
        FROM knowledge_chunks
        WHERE tenant_id = :tid AND embedding IS NOT NULL
        ORDER BY embedding <=> (:qvec)::vector
        LIMIT :k
        """
    )
    try:
        rows = (
            await db.execute(sql, {"qvec": literal, "tid": tenant_id, "k": top_k})
        ).all()
    except Exception:
        # pgvector not available (e.g. sqlite tests) — fall back to recent rows.
        rows = []

    if not rows:
        # Fallback: return the newest chunks so callers still get *some* context.
        recent = await list_chunks(db, tenant_id, limit=top_k)
        return [(c, 0.0) for c in recent]

    ids = [r[0] for r in rows]
    distances = {r[0]: float(r[1]) for r in rows}
    result = await db.execute(
        select(KnowledgeChunk).where(KnowledgeChunk.id.in_(ids))
    )
    chunks_by_id = {c.id: c for c in result.scalars().all()}
    # Preserve distance ordering and convert distance -> similarity score.
    ordered: list[tuple[KnowledgeChunk, float]] = []
    for cid in ids:
        c = chunks_by_id.get(cid)
        if c is not None:
            ordered.append((c, 1.0 - distances[cid]))
    return ordered


# Re-export helper for routers/agents
to_response_dict = _to_response_dict
