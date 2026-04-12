"""Shared LangGraph checkpointer — Postgres-backed for production, memory for dev."""
from __future__ import annotations

from functools import lru_cache

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import MemorySaver

from app.core.config import settings


@lru_cache(maxsize=1)
def get_checkpointer() -> BaseCheckpointSaver:
    """Return a process-wide checkpointer.

    Uses in-memory saver by default to keep startup simple; swap to
    PostgresSaver once migrations for langgraph tables are run.
    """
    if settings.DEBUG:
        return MemorySaver()

    try:
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

        conn_string = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
        saver = AsyncPostgresSaver.from_conn_string(conn_string)
        return saver
    except Exception:
        return MemorySaver()
