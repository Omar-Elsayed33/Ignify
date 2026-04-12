from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


ChannelTypeLiteral = Literal["whatsapp", "instagram", "messenger", "web"]
LanguageLiteral = Literal["ar", "en"]


class InboxDraftRequest(BaseModel):
    conversation_id: uuid.UUID
    customer_message: str = Field(..., min_length=1)
    language: LanguageLiteral = "ar"
    channel_type: ChannelTypeLiteral = "whatsapp"


class InboxDraftResponse(BaseModel):
    draft_reply: str
    intent: str | None = None
    confidence: float | None = None
    needs_human: bool = False
    meta: dict[str, Any] = Field(default_factory=dict)


class InboxSendRequest(BaseModel):
    conversation_id: uuid.UUID
    message: str = Field(..., min_length=1)


class InboxMessageItem(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class InboxConversationItem(BaseModel):
    id: uuid.UUID
    channel_id: uuid.UUID
    channel_type: str | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    last_message: str | None = None
    last_message_at: datetime | None = None
    updated_at: datetime
