import uuid
from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel


class SEOKeywordCreate(BaseModel):
    keyword: str
    search_volume: Optional[int] = None
    difficulty: Optional[int] = None
    current_rank: Optional[int] = None
    target_url: Optional[str] = None


class SEOKeywordUpdate(BaseModel):
    search_volume: Optional[int] = None
    difficulty: Optional[int] = None
    current_rank: Optional[int] = None
    target_url: Optional[str] = None


class SEOKeywordResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    keyword: str
    search_volume: Optional[int] = None
    difficulty: Optional[int] = None
    current_rank: Optional[int] = None
    target_url: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SEORankingResponse(BaseModel):
    id: uuid.UUID
    keyword_id: uuid.UUID
    rank: int
    url: Optional[str] = None
    date: date

    model_config = {"from_attributes": True}


class SEOAuditCreate(BaseModel):
    audit_type: str
    score: Optional[int] = None
    issues: Optional[list[dict[str, Any]]] = None
    recommendations: Optional[list[dict[str, Any]]] = None


class SEOAuditResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    audit_type: str
    score: Optional[int] = None
    issues: Optional[Any] = None
    recommendations: Optional[Any] = None
    created_at: datetime

    model_config = {"from_attributes": True}
