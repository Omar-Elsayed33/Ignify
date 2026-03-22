import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel

from app.db.models import MessageRole


class SessionResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    channel_id: uuid.UUID
    external_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    tenant_id: uuid.UUID
    role: MessageRole
    content: str
    metadata: Optional[dict[str, Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class InboundMessageRequest(BaseModel):
    channel_id: uuid.UUID
    external_id: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    content: str
    metadata: Optional[dict[str, Any]] = None


class InboundMessageResponse(BaseModel):
    session_id: uuid.UUID
    response: str


class ToolCallbackRequest(BaseModel):
    session_id: uuid.UUID
    tool_name: str
    tool_result: dict[str, Any]
