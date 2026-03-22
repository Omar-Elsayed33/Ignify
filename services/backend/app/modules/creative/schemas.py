import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel

from app.db.models import AssetType


class CreativeAssetCreate(BaseModel):
    name: str
    asset_type: AssetType
    file_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    prompt_used: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class CreativeAssetUpdate(BaseModel):
    name: Optional[str] = None
    file_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class CreativeAssetResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    asset_type: AssetType
    file_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    prompt_used: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ImageGenerateRequest(BaseModel):
    prompt: str
    asset_type: AssetType = AssetType.image
    name: Optional[str] = None
    width: int = 1024
    height: int = 1024
    style: Optional[str] = None
