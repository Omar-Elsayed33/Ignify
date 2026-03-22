from typing import Any, Optional

from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    context: Optional[dict[str, Any]] = None
    conversation_history: Optional[list[dict[str, str]]] = None


class ChatResponse(BaseModel):
    response: str
    metadata: Optional[dict[str, Any]] = None
