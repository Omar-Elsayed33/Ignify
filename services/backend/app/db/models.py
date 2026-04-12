import enum
import uuid
from datetime import date, datetime, timezone
from typing import Any, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_uuid() -> uuid.UUID:
    return uuid.uuid4()


# ──────────────────────────── Enums ────────────────────────────


class UserRole(str, enum.Enum):
    owner = "owner"
    admin = "admin"
    editor = "editor"
    viewer = "viewer"
    superadmin = "superadmin"


class ChannelType(str, enum.Enum):
    whatsapp = "whatsapp"
    messenger = "messenger"
    instagram = "instagram"
    email = "email"
    slack = "slack"
    snapchat = "snapchat"
    youtube = "youtube"


class ChannelStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    connecting = "connecting"


class MessageRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"
    system = "system"
    tool = "tool"


class ProviderType(str, enum.Enum):
    openai = "openai"
    anthropic = "anthropic"
    google = "google"
    openrouter = "openrouter"


class PostType(str, enum.Enum):
    blog = "blog"
    social = "social"
    email = "email"
    ad_copy = "ad_copy"


class ContentStatus(str, enum.Enum):
    draft = "draft"
    scheduled = "scheduled"
    published = "published"


class AssetType(str, enum.Enum):
    image = "image"
    banner = "banner"
    logo = "logo"
    mockup = "mockup"


class AdPlatform(str, enum.Enum):
    google = "google"
    meta = "meta"
    snapchat = "snapchat"
    youtube = "youtube"


class SocialPlatform(str, enum.Enum):
    instagram = "instagram"
    facebook = "facebook"
    twitter = "twitter"
    linkedin = "linkedin"
    tiktok = "tiktok"
    snapchat = "snapchat"
    youtube = "youtube"


class LeadSource(str, enum.Enum):
    whatsapp = "whatsapp"
    messenger = "messenger"
    instagram = "instagram"
    website = "website"
    ads = "ads"
    manual = "manual"


class LeadStatus(str, enum.Enum):
    new = "new"
    contacted = "contacted"
    qualified = "qualified"
    proposal = "proposal"
    won = "won"
    lost = "lost"


class CampaignType(str, enum.Enum):
    email_drip = "email_drip"
    social = "social"
    ads = "ads"
    multi_channel = "multi_channel"


class CampaignStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    paused = "paused"
    completed = "completed"


class SocialPostStatus(str, enum.Enum):
    draft = "draft"
    scheduled = "scheduled"
    published = "published"
    failed = "failed"


class IntegrationStatus(str, enum.Enum):
    connected = "connected"
    disconnected = "disconnected"
    error = "error"


# ──────────────────────────── Base ────────────────────────────


class Base(DeclarativeBase):
    pass


# ──────────────────────────── Core ────────────────────────────


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    max_users: Mapped[int] = mapped_column(Integer, default=5)
    max_channels: Mapped[int] = mapped_column(Integer, default=3)
    max_credits: Mapped[int] = mapped_column(Integer, default=1000)
    price_monthly: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    features: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=dict)

    tenants: Mapped[list["Tenant"]] = relationship(back_populates="plan")


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    plan_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("plans.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    config: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    plan: Mapped[Optional["Plan"]] = relationship(back_populates="tenants")
    users: Mapped[list["User"]] = relationship(back_populates="tenant")
    channels: Mapped[list["Channel"]] = relationship(back_populates="tenant")
    brand_settings: Mapped[Optional["BrandSettings"]] = relationship(back_populates="tenant", uselist=False)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.viewer)
    lang_preference: Mapped[str] = mapped_column(String(10), default="en")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    tenant: Mapped[Optional["Tenant"]] = relationship(back_populates="users")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(back_populates="user")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    token: Mapped[str] = mapped_column(String(1000), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")


class Invitation(Base):
    __tablename__ = "invitations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.viewer)
    token: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)
    invited_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(255), nullable=False)
    resource_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    resource_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    details: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# ──────────────────────────── Channels & Messaging ────────────────────────────


class Channel(Base):
    __tablename__ = "channels"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    type: Mapped[ChannelType] = mapped_column(Enum(ChannelType), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    config: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=dict)
    status: Mapped[ChannelStatus] = mapped_column(Enum(ChannelStatus), default=ChannelStatus.inactive)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    tenant: Mapped["Tenant"] = relationship(back_populates="channels")
    sessions: Mapped[list["Session"]] = relationship(back_populates="channel")
    channel_skills: Mapped[list["ChannelSkill"]] = relationship(back_populates="channel")


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    channel_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("channels.id"), nullable=False)
    external_id: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    customer_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    customer_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    metadata_: Mapped[Optional[dict[str, Any]]] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    channel: Mapped["Channel"] = relationship(back_populates="sessions")
    messages: Mapped[list["Message"]] = relationship(back_populates="session")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    role: Mapped[MessageRole] = mapped_column(Enum(MessageRole), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_: Mapped[Optional[dict[str, Any]]] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    session: Mapped["Session"] = relationship(back_populates="messages")


# ──────────────────────────── Skills/Modules ────────────────────────────


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    icon: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    prompt_template: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tools: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=list)
    config_schema: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    installations: Mapped[list["SkillInstallation"]] = relationship(back_populates="skill")


class SkillInstallation(Base):
    __tablename__ = "skill_installations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    skill_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("skills.id"), nullable=False)
    config: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    installed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    skill: Mapped["Skill"] = relationship(back_populates="installations")
    channel_skills: Mapped[list["ChannelSkill"]] = relationship(back_populates="skill_installation")


class ChannelSkill(Base):
    __tablename__ = "channel_skills"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    channel_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("channels.id"), nullable=False)
    skill_installation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("skill_installations.id"), nullable=False)

    channel: Mapped["Channel"] = relationship(back_populates="channel_skills")
    skill_installation: Mapped["SkillInstallation"] = relationship(back_populates="channel_skills")


# ──────────────────────────── AI Config ────────────────────────────


class AIProvider(Base):
    __tablename__ = "ai_providers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    provider_type: Mapped[ProviderType] = mapped_column(Enum(ProviderType), nullable=False)
    api_base_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    default_model: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class TenantAIConfig(Base):
    __tablename__ = "tenant_ai_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    provider_slug: Mapped[str] = mapped_column(String(255), nullable=False)
    api_key_encrypted: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    model: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    config: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=dict)


# ──────────────────────────── Credits & Billing ────────────────────────────


class CreditPricing(Base):
    __tablename__ = "credit_pricing"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    action_type: Mapped[str] = mapped_column(String(100), nullable=False)
    credits_cost: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)


class CreditBalance(Base):
    __tablename__ = "credit_balances"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), unique=True, nullable=False)
    balance: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class CreditTransaction(Base):
    __tablename__ = "credit_transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    action_type: Mapped[str] = mapped_column(String(100), nullable=False)
    credits_used: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class CreditPurchase(Base):
    __tablename__ = "credit_purchases"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    credits: Mapped[int] = mapped_column(Integer, nullable=False)
    payment_ref: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# ──────────────────────────── Marketing - Content ────────────────────────────


class ContentPost(Base):
    __tablename__ = "content_posts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    post_type: Mapped[PostType] = mapped_column(Enum(PostType), nullable=False)
    platform: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[ContentStatus] = mapped_column(Enum(ContentStatus), default=ContentStatus.draft)
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_: Mapped[Optional[dict[str, Any]]] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ContentCalendar(Base):
    __tablename__ = "content_calendar"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    content_post_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("content_posts.id"), nullable=False)
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False)
    platform: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[ContentStatus] = mapped_column(Enum(ContentStatus), default=ContentStatus.scheduled)


# ──────────────────────────── Marketing - Creative ────────────────────────────


class CreativeAsset(Base):
    __tablename__ = "creative_assets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    asset_type: Mapped[AssetType] = mapped_column(Enum(AssetType), nullable=False)
    file_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    prompt_used: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_: Mapped[Optional[dict[str, Any]]] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# ──────────────────────────── Marketing - Ads ────────────────────────────


class AdAccount(Base):
    __tablename__ = "ad_accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    platform: Mapped[AdPlatform] = mapped_column(Enum(AdPlatform), nullable=False)
    account_id: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    access_token_encrypted: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    refresh_token_encrypted: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AdCampaign(Base):
    __tablename__ = "ad_campaigns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    ad_account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ad_accounts.id"), nullable=False)
    platform: Mapped[AdPlatform] = mapped_column(Enum(AdPlatform), nullable=False)
    campaign_id_external: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="draft")
    budget_daily: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    budget_total: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    config: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    ad_account: Mapped["AdAccount"] = relationship()
    performance: Mapped[list["AdPerformance"]] = relationship(back_populates="campaign")


class AdPerformance(Base):
    __tablename__ = "ad_performance"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    ad_campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ad_campaigns.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    impressions: Mapped[int] = mapped_column(Integer, default=0)
    clicks: Mapped[int] = mapped_column(Integer, default=0)
    conversions: Mapped[int] = mapped_column(Integer, default=0)
    spend: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    revenue: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    ctr: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cpc: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    roas: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    metadata_: Mapped[Optional[dict[str, Any]]] = mapped_column("metadata", JSON, default=dict)

    campaign: Mapped["AdCampaign"] = relationship(back_populates="performance")


# ──────────────────────────── Marketing - SEO ────────────────────────────


class SEOKeyword(Base):
    __tablename__ = "seo_keywords"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    keyword: Mapped[str] = mapped_column(String(500), nullable=False)
    search_volume: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    difficulty: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    current_rank: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    target_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    rankings: Mapped[list["SEORanking"]] = relationship(back_populates="keyword")


class SEORanking(Base):
    __tablename__ = "seo_rankings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    keyword_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("seo_keywords.id"), nullable=False)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)

    keyword: Mapped["SEOKeyword"] = relationship(back_populates="rankings")


class SEOAudit(Base):
    __tablename__ = "seo_audits"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    audit_type: Mapped[str] = mapped_column(String(100), nullable=False)
    score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    issues: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=list)
    recommendations: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# ──────────────────────────── Marketing - Social ────────────────────────────


class SocialAccount(Base):
    __tablename__ = "social_accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    platform: Mapped[SocialPlatform] = mapped_column(Enum(SocialPlatform), nullable=False)
    account_id: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    access_token_encrypted: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SocialPost(Base):
    __tablename__ = "social_posts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    social_account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("social_accounts.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    media_urls: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=list)
    status: Mapped[SocialPostStatus] = mapped_column(Enum(SocialPostStatus), default=SocialPostStatus.draft)
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    external_post_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    social_account: Mapped["SocialAccount"] = relationship()
    metrics: Mapped[list["SocialMetric"]] = relationship(back_populates="social_post")


class SocialMetric(Base):
    __tablename__ = "social_metrics"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    social_post_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("social_posts.id"), nullable=False)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    comments: Mapped[int] = mapped_column(Integer, default=0)
    shares: Mapped[int] = mapped_column(Integer, default=0)
    impressions: Mapped[int] = mapped_column(Integer, default=0)
    reach: Mapped[int] = mapped_column(Integer, default=0)
    engagement_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    social_post: Mapped["SocialPost"] = relationship(back_populates="metrics")


# ──────────────────────────── Marketing - Leads/CRM ────────────────────────────


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    company: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    source: Mapped[LeadSource] = mapped_column(Enum(LeadSource), default=LeadSource.manual)
    score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[LeadStatus] = mapped_column(Enum(LeadStatus), default=LeadStatus.new)
    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    metadata_: Mapped[Optional[dict[str, Any]]] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    activities: Mapped[list["LeadActivity"]] = relationship(back_populates="lead")


class LeadPipelineStage(Base):
    __tablename__ = "lead_pipeline_stages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)


class LeadActivity(Base):
    __tablename__ = "lead_activities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False)
    activity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    lead: Mapped["Lead"] = relationship(back_populates="activities")


# ──────────────────────────── Marketing - Campaigns ────────────────────────────


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    campaign_type: Mapped[CampaignType] = mapped_column(Enum(CampaignType), nullable=False)
    status: Mapped[CampaignStatus] = mapped_column(Enum(CampaignStatus), default=CampaignStatus.draft)
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    config: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    steps: Mapped[list["CampaignStep"]] = relationship(back_populates="campaign")
    audiences: Mapped[list["CampaignAudience"]] = relationship(back_populates="campaign")


class CampaignStep(Base):
    __tablename__ = "campaign_steps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    action_type: Mapped[str] = mapped_column(String(100), nullable=False)
    config: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=dict)
    delay_hours: Mapped[int] = mapped_column(Integer, default=0)

    campaign: Mapped["Campaign"] = relationship(back_populates="steps")


class CampaignAudience(Base):
    __tablename__ = "campaign_audiences"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    filters: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=dict)
    size: Mapped[int] = mapped_column(Integer, default=0)

    campaign: Mapped["Campaign"] = relationship(back_populates="audiences")


# ──────────────────────────── Marketing - Analytics ────────────────────────────


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    report_type: Mapped[str] = mapped_column(String(100), nullable=False)
    config: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=dict)
    file_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    snapshots: Mapped[list["ReportSnapshot"]] = relationship(back_populates="report")


class ReportSnapshot(Base):
    __tablename__ = "report_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    report_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("reports.id"), nullable=False)
    data: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=dict)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    report: Mapped["Report"] = relationship(back_populates="snapshots")


# ──────────────────────────── Marketing - Competitors ────────────────────────────


class Competitor(Base):
    __tablename__ = "competitors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    website: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    instagram_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    facebook_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    twitter_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    linkedin_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    tiktok_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    youtube_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    snapshots: Mapped[list["CompetitorSnapshot"]] = relationship(back_populates="competitor")


class CompetitorSnapshot(Base):
    __tablename__ = "competitor_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    competitor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("competitors.id"), nullable=False)
    data: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=dict)
    snapshot_type: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    competitor: Mapped["Competitor"] = relationship(back_populates="snapshots")


# ──────────────────────────── Integrations ────────────────────────────


class Integration(Base):
    __tablename__ = "integrations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    platform: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[IntegrationStatus] = mapped_column(Enum(IntegrationStatus), default=IntegrationStatus.disconnected)
    config: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    tokens: Mapped[list["IntegrationToken"]] = relationship(back_populates="integration")


class IntegrationToken(Base):
    __tablename__ = "integration_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    integration_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("integrations.id"), nullable=False)
    access_token_encrypted: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    refresh_token_encrypted: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    integration: Mapped["Integration"] = relationship(back_populates="tokens")


# ──────────────────────────── Brand Settings ────────────────────────────


class BrandSettings(Base):
    __tablename__ = "brand_settings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), unique=True, nullable=False)
    brand_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    brand_voice: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tone: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    colors: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=dict)
    fonts: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=dict)
    logo_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    tenant: Mapped["Tenant"] = relationship(back_populates="brand_settings")


# ──────────────────────────── Platform ────────────────────────────


class PlatformChannel(Base):
    __tablename__ = "platform_channels"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    channel_type: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    config: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class TenantPhoneNumber(Base):
    __tablename__ = "tenant_phone_numbers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    platform_channel_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("platform_channels.id"), nullable=False)
    phone_number: Mapped[str] = mapped_column(String(50), nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
