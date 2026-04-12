"""Per-node tracing for LangGraph agent runs.

`AgentTracer` is a LangChain async callback handler that collects a timeline of
chain/LLM events. The resulting `.traces` list is intended to be persisted on
the `AgentRun.output["_traces"]` field for later inspection in the admin UI.
"""
from __future__ import annotations

import time
import uuid
from typing import Any

try:
    from langchain_core.callbacks import AsyncCallbackHandler
except Exception:  # pragma: no cover - fallback when langchain not importable
    class AsyncCallbackHandler:  # type: ignore[no-redef]
        pass


def _now_ms() -> int:
    return int(time.time() * 1000)


def _safe_keys(obj: Any) -> list[str]:
    if isinstance(obj, dict):
        return list(obj.keys())
    return []


def _extract_node_name(serialized: dict[str, Any] | None, **kwargs: Any) -> str | None:
    # LangGraph sets the node name in kwargs["name"] for chain events
    name = kwargs.get("name")
    if name:
        return str(name)
    if isinstance(serialized, dict):
        nm = serialized.get("name") or serialized.get("id")
        if isinstance(nm, list) and nm:
            return str(nm[-1])
        if nm:
            return str(nm)
    return None


class AgentTracer(AsyncCallbackHandler):
    """Collects per-node execution traces for a single agent run."""

    def __init__(self, tenant_id: str | uuid.UUID, run_id: str | uuid.UUID) -> None:
        self.tenant_id = str(tenant_id)
        self.run_id = str(run_id)
        self.traces: list[dict[str, Any]] = []
        # run_id -> partial trace entry
        self._open: dict[str, dict[str, Any]] = {}
        # llm run_id -> token accumulator (to attribute tokens to parent chain)
        self._llm_parents: dict[str, str] = {}

    # ── Chain (graph node) events ───────────────────────────────────────

    async def on_chain_start(
        self,
        serialized: dict[str, Any] | None,
        inputs: Any,
        *,
        run_id: uuid.UUID | str | None = None,
        parent_run_id: uuid.UUID | str | None = None,
        **kwargs: Any,
    ) -> None:
        node = _extract_node_name(serialized, **kwargs)
        # Skip noisy framework wrappers with no useful name
        if not node or node.startswith("__"):
            return
        entry: dict[str, Any] = {
            "node": node,
            "started_at": _now_ms(),
            "finished_at": None,
            "duration_ms": None,
            "input_keys": _safe_keys(inputs),
            "output_keys": [],
            "tokens_in": 0,
            "tokens_out": 0,
            "cost": 0.0,
            "status": "running",
            "error": None,
        }
        self._open[str(run_id)] = entry

    async def on_chain_end(
        self,
        outputs: Any,
        *,
        run_id: uuid.UUID | str | None = None,
        **kwargs: Any,
    ) -> None:
        key = str(run_id)
        entry = self._open.pop(key, None)
        if entry is None:
            return
        entry["finished_at"] = _now_ms()
        entry["duration_ms"] = entry["finished_at"] - entry["started_at"]
        entry["output_keys"] = _safe_keys(outputs)
        entry["status"] = "succeeded"
        self.traces.append(entry)

    async def on_chain_error(
        self,
        error: BaseException,
        *,
        run_id: uuid.UUID | str | None = None,
        **kwargs: Any,
    ) -> None:
        key = str(run_id)
        entry = self._open.pop(key, None)
        if entry is None:
            return
        entry["finished_at"] = _now_ms()
        entry["duration_ms"] = entry["finished_at"] - entry["started_at"]
        entry["status"] = "failed"
        entry["error"] = str(error)[:500]
        self.traces.append(entry)

    # ── LLM events — attribute tokens/cost to parent chain node ─────────

    async def on_llm_start(
        self,
        serialized: dict[str, Any] | None,
        prompts: list[str],
        *,
        run_id: uuid.UUID | str | None = None,
        parent_run_id: uuid.UUID | str | None = None,
        **kwargs: Any,
    ) -> None:
        if parent_run_id is not None:
            self._llm_parents[str(run_id)] = str(parent_run_id)

    async def on_chat_model_start(
        self,
        serialized: dict[str, Any] | None,
        messages: Any,
        *,
        run_id: uuid.UUID | str | None = None,
        parent_run_id: uuid.UUID | str | None = None,
        **kwargs: Any,
    ) -> None:
        if parent_run_id is not None:
            self._llm_parents[str(run_id)] = str(parent_run_id)

    async def on_llm_end(
        self,
        response: Any,
        *,
        run_id: uuid.UUID | str | None = None,
        **kwargs: Any,
    ) -> None:
        parent = self._llm_parents.pop(str(run_id), None)
        if parent is None:
            return
        entry = self._open.get(parent)
        if entry is None:
            return

        tokens_in = 0
        tokens_out = 0
        try:
            usage = None
            if hasattr(response, "llm_output") and isinstance(response.llm_output, dict):
                usage = response.llm_output.get("token_usage") or response.llm_output.get("usage")
            if not usage and hasattr(response, "generations"):
                for gen_group in response.generations:
                    for gen in gen_group:
                        msg = getattr(gen, "message", None)
                        meta = getattr(msg, "usage_metadata", None) if msg else None
                        if meta:
                            tokens_in += int(meta.get("input_tokens", 0) or 0)
                            tokens_out += int(meta.get("output_tokens", 0) or 0)
            if usage:
                tokens_in += int(usage.get("prompt_tokens", 0) or usage.get("input_tokens", 0) or 0)
                tokens_out += int(usage.get("completion_tokens", 0) or usage.get("output_tokens", 0) or 0)
        except Exception:
            pass

        entry["tokens_in"] = entry.get("tokens_in", 0) + tokens_in
        entry["tokens_out"] = entry.get("tokens_out", 0) + tokens_out
