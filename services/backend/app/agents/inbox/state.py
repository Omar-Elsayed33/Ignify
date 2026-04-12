"""Shared state schema for InboxAgent graph."""
from __future__ import annotations

from typing import Any, TypedDict


class InboxState(TypedDict, total=False):
    tenant_id: str
    conversation_id: str
    channel_type: str                  # "whatsapp" | "instagram" | "messenger" | "web"
    language: str                      # "ar" | "en"
    customer_message: str
    conversation_history: list[dict[str, Any]]
    knowledge_base: str
    brand_voice: dict[str, Any]
    intent: str | None                 # greeting | question | complaint | purchase_intent | booking | feedback | spam | other
    needs_human: bool
    draft_reply: str | None
    confidence: float | None
    meta: dict[str, Any]
