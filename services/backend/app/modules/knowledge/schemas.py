from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

KBSource = Literal["faq", "product", "policy", "custom"]


class KnowledgeChunkBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=512)
    content: str = Field(..., min_length=1)
    source: KBSource = "custom"
    metadata: Optional[dict[str, Any]] = None


class KnowledgeChunkCreate(KnowledgeChunkBase):
    pass


class KnowledgeChunkUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    source: Optional[KBSource] = None
    metadata: Optional[dict[str, Any]] = None


class KnowledgeChunkResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    source: str
    title: str
    content: str
    metadata: dict[str, Any] = {}
    created_at: datetime

    model_config = {"from_attributes": True}


class BulkImportItem(BaseModel):
    title: str
    content: str
    source: Optional[KBSource] = "custom"
    metadata: Optional[dict[str, Any]] = None


class BulkImportRequest(BaseModel):
    chunks: list[BulkImportItem] = Field(..., min_length=1)


class BulkImportResponse(BaseModel):
    inserted: int


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    top_k: int = Field(5, ge=1, le=50)


class SearchHit(KnowledgeChunkResponse):
    score: float = 0.0


class SearchResponse(BaseModel):
    hits: list[SearchHit] = []
