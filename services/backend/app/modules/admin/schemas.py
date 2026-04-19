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
    subscription_active: bool = False
    config: Optional[dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TenantAdminUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    plan_id: Optional[uuid.UUID] = None


class TenantPlanUpdate(BaseModel):
    plan_code: str
    activate_subscription: bool = True


class TenantSubscriptionUpdate(BaseModel):
    subscription_active: bool


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


class PlanModeConfigItem(BaseModel):
    """One subagent entry within a plan mode."""
    subagent_name: str
    model: str
    updated_at: datetime

    model_config = {"from_attributes": True}


class PlanModeConfigUpdate(BaseModel):
    """Body for PUT /admin/plan-modes/{mode} — list of subagent→model assignments."""
    assignments: list[dict]  # [{subagent_name, model}]


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


class MarketingPlanAdminItem(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    tenant_name: Optional[str] = None
    title: str
    status: str
    version: int
    created_at: datetime

    model_config = {"from_attributes": True}


class AgentRunAdminItem(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    tenant_name: Optional[str] = None
    agent_name: str
    model: Optional[str] = None
    status: str
    cost_usd: Optional[float] = None
    latency_ms: Optional[int] = None
    started_at: datetime

    model_config = {"from_attributes": True}


class TenantDetailResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    plan_name: Optional[str] = None
    is_active: bool
    user_count: int
    plan_count: int
    agent_run_count: int
    created_at: datetime
    onboarding_completed: bool = False

    model_config = {"from_attributes": True}


class GlobalSettingsResponse(BaseModel):
    openrouter_api_key_set: bool
    openrouter_base_url: str
    replicate_token_set: bool
    elevenlabs_key_set: bool
    stripe_key_set: bool
    paymob_configured: bool
    paytabs_configured: bool
    geidea_configured: bool
    email_verification_required: bool = False


class TenantAgentConfigAdminItem(BaseModel):
    tenant_id: uuid.UUID
    agent_name: str
    model: Optional[str] = None
    is_enabled: bool = True
    system_prompt_set: bool = False
    temperature: Optional[float] = None

    model_config = {"from_attributes": True}


class TenantAgentConfigUpdate(BaseModel):
    model: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = None
    is_enabled: Optional[bool] = None
    max_tokens: Optional[int] = None


class CostByAgentItem(BaseModel):
    agent_name: str
    total_cost_usd: float
    run_count: int


class CostByTenantItem(BaseModel):
    tenant_id: uuid.UUID
    tenant_name: Optional[str] = None
    total_cost_usd: float
    run_count: int


class CostStatsResponse(BaseModel):
    by_agent: list[CostByAgentItem]
    by_tenant: list[CostByTenantItem]
    total_cost_usd: float


class AgentListItem(BaseModel):
    name: str
    default_model: str
    description: Optional[str] = None
    sub_agents: list[str] = []


class AgentGraphResponse(BaseModel):
    name: str
    mermaid: str
    nodes: list[str] = []
    edges: list[dict[str, Any]] = []
    raw: Optional[dict[str, Any]] = None


class AgentRunDetailResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    tenant_name: Optional[str] = None
    agent_name: str
    model: Optional[str] = None
    status: str
    input: Optional[dict[str, Any]] = None
    output: Optional[dict[str, Any]] = None
    traces: list[dict[str, Any]] = []
    error: Optional[str] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    cost_usd: Optional[float] = None
    latency_ms: Optional[int] = None
    started_at: datetime
    finished_at: Optional[datetime] = None


class PlanAdminResponse(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    prices: dict[str, Any] = {}
    features: dict[str, Any] = {}
    max_users: int
    max_channels: int
    max_credits: int
    is_active: bool = True

    model_config = {"from_attributes": True}


class PlanAdminUpdate(BaseModel):
    name: Optional[str] = None
    prices: Optional[dict[str, Any]] = None
    features: Optional[dict[str, Any]] = None
    max_users: Optional[int] = None
    max_channels: Optional[int] = None
    max_credits: Optional[int] = None
    is_active: Optional[bool] = None


class PlanAdminCreate(BaseModel):
    slug: str
    name: str
    prices: dict[str, Any] = {}
    features: dict[str, Any] = {}
    max_users: int = 5
    max_channels: int = 3
    max_credits: int = 1000
    is_active: bool = True


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


class OfflinePaymentAdminResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    tenant_name: str
    plan_id: Optional[uuid.UUID] = None
    plan_name: Optional[str] = None
    amount: float
    currency: str
    payment_method: str
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    status: str
    admin_notes: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime


class OfflinePaymentReview(BaseModel):
    admin_notes: Optional[str] = None
