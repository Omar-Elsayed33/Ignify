from __future__ import annotations

import logging
import uuid

from app.agents.base import BaseSubAgent

logger = logging.getLogger(__name__)


class KBRetriever(BaseSubAgent):
    name = "kb_retriever"
    model_tier = "fast"
    system_prompt = ""

    async def execute(self, state):
        query = (state.get("customer_message") or "").strip()
        tenant_id_raw = state.get("tenant_id")
        existing_meta = state.get("meta", {}) or {}
        fallback_kb = (state.get("knowledge_base") or "") or ""

        if not query or not tenant_id_raw:
            snippet = fallback_kb[:2000]
            return {
                "knowledge_base": snippet,
                "meta": {**existing_meta, "kb_used": bool(snippet), "kb_mode": "fallback"},
            }

        try:
            tenant_id = uuid.UUID(str(tenant_id_raw))
        except (ValueError, TypeError):
            snippet = fallback_kb[:2000]
            return {
                "knowledge_base": snippet,
                "meta": {**existing_meta, "kb_used": bool(snippet), "kb_mode": "fallback"},
            }

        # Import locally to avoid a hard dependency during graph build.
        from app.db.database import async_session
        from app.modules.knowledge.service import search

        try:
            async with async_session() as db:
                results = await search(db, tenant_id, query, top_k=5)
        except Exception as e:  # noqa: BLE001
            logger.warning("kb_retriever: vector search failed — %s", e)
            results = []

        if not results:
            snippet = fallback_kb[:2000]
            return {
                "knowledge_base": snippet,
                "meta": {
                    **existing_meta,
                    "kb_used": bool(snippet),
                    "kb_mode": "fallback",
                    "kb_hits": 0,
                },
            }

        parts: list[str] = []
        for chunk, score in results:
            parts.append(f"[{chunk.title}] ({score:.3f})\n{chunk.content}")
        joined = "\n\n---\n\n".join(parts)
        # Cap to keep prompt lean
        if len(joined) > 6000:
            joined = joined[:6000]
        return {
            "knowledge_base": joined,
            "meta": {
                **existing_meta,
                "kb_used": True,
                "kb_mode": "vector",
                "kb_hits": len(results),
            },
        }
