"""Shared state schema for LeadAgent graph."""
from __future__ import annotations

from typing import Any, TypedDict


class LeadState(TypedDict, total=False):
    tenant_id: str
    lead: dict[str, Any]  # name, phone, email, notes, history, source, status
    score: int | None
    qualification: str | None  # hot | warm | cold
    next_action: str | None
    meta: dict[str, Any]
