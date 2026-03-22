import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel

from app.db.models import ProviderType, UserRole


class DashboardStatsResponse(BaseModel):
    total_tenants: int
    total_users: int
    total_channels: int
    total_messages: int
    active_campaigns: int


class TenantAdminResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    plan_id: Optional[uuid.UUID] = None
    is_active: bool
    config: Optional[dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TenantAdminUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    plan_id: Optional[uuid.UUID] = None


class AIProviderCreate(BaseModel):
    name: str
    slug: str
    provider_type: ProviderType
    api_base_url: Optional[str] = None
    default_model: Optional[str] = None
    is_active: bool = True
    is_default: bool = False


class AIProviderResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    provider_type: ProviderType
    api_base_url: Optional[str] = None
    default_model: Optional[str] = None
    is_active: bool
    is_default: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class PlatformChannelCreate(BaseModel):
    channel_type: str
    name: str
    config: Optional[dict[str, Any]] = None
    is_active: bool = True


class PlatformChannelResponse(BaseModel):
    id: uuid.UUID
    channel_type: str
    name: str
    config: Optional[dict[str, Any]] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SkillResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: Optional[str] = None
    category: Optional[str] = None
    icon: Optional[str] = None
    is_active: bool

    model_config = {"from_attributes": True}


class AuditLogResponse(BaseModel):
    id: uuid.UUID
    tenant_id: Optional[uuid.UUID] = None
    user_id: Optional[uuid.UUID] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    details: Optional[dict[str, Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True}
