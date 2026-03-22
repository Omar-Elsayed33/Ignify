import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select

from app.db.models import (
    AIProvider,
    AuditLog,
    Campaign,
    CampaignStatus,
    Channel,
    Message,
    PlatformChannel,
    Skill,
    Tenant,
    User,
    UserRole,
)
from app.dependencies import DbSession, require_role
from app.modules.admin.schemas import (
    AIProviderCreate,
    AIProviderResponse,
    AuditLogResponse,
    DashboardStatsResponse,
    PlatformChannelCreate,
    PlatformChannelResponse,
    SkillResponse,
    TenantAdminResponse,
    TenantAdminUpdate,
)

router = APIRouter(prefix="/admin", tags=["admin"])

superadmin_dep = Depends(require_role(UserRole.superadmin))


@router.get("/dashboard", response_model=DashboardStatsResponse, dependencies=[superadmin_dep])
async def dashboard_stats(db: DbSession):
    tenants = (await db.execute(select(func.count(Tenant.id)))).scalar() or 0
    users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    channels = (await db.execute(select(func.count(Channel.id)))).scalar() or 0
    messages = (await db.execute(select(func.count(Message.id)))).scalar() or 0
    active_campaigns = (
        await db.execute(select(func.count(Campaign.id)).where(Campaign.status == CampaignStatus.active))
    ).scalar() or 0

    return DashboardStatsResponse(
        total_tenants=tenants,
        total_users=users,
        total_channels=channels,
        total_messages=messages,
        active_campaigns=active_campaigns,
    )


# ── Tenant Management ──


@router.get("/tenants", response_model=list[TenantAdminResponse], dependencies=[superadmin_dep])
async def list_tenants(db: DbSession, skip: int = 0, limit: int = 50):
    result = await db.execute(select(Tenant).order_by(Tenant.created_at.desc()).offset(skip).limit(limit))
    return result.scalars().all()


@router.get("/tenants/{tenant_id}", response_model=TenantAdminResponse, dependencies=[superadmin_dep])
async def get_tenant(tenant_id: uuid.UUID, db: DbSession):
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return tenant


@router.put("/tenants/{tenant_id}", response_model=TenantAdminResponse, dependencies=[superadmin_dep])
async def update_tenant(tenant_id: uuid.UUID, data: TenantAdminUpdate, db: DbSession):
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(tenant, field, value)
    await db.flush()
    return tenant


# ── AI Providers ──


@router.get("/ai-providers", response_model=list[AIProviderResponse], dependencies=[superadmin_dep])
async def list_ai_providers(db: DbSession):
    result = await db.execute(select(AIProvider).order_by(AIProvider.created_at.desc()))
    return result.scalars().all()


@router.post("/ai-providers", response_model=AIProviderResponse, status_code=status.HTTP_201_CREATED, dependencies=[superadmin_dep])
async def create_ai_provider(data: AIProviderCreate, db: DbSession):
    provider = AIProvider(
        name=data.name,
        slug=data.slug,
        provider_type=data.provider_type,
        api_base_url=data.api_base_url,
        default_model=data.default_model,
        is_active=data.is_active,
        is_default=data.is_default,
    )
    db.add(provider)
    await db.flush()
    return provider


@router.put("/ai-providers/{provider_id}", response_model=AIProviderResponse, dependencies=[superadmin_dep])
async def update_ai_provider(provider_id: uuid.UUID, data: AIProviderCreate, db: DbSession):
    result = await db.execute(select(AIProvider).where(AIProvider.id == provider_id))
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(provider, field, value)
    await db.flush()
    return provider


# ── Platform Channels ──


@router.get("/platform-channels", response_model=list[PlatformChannelResponse], dependencies=[superadmin_dep])
async def list_platform_channels(db: DbSession):
    result = await db.execute(select(PlatformChannel).order_by(PlatformChannel.created_at.desc()))
    return result.scalars().all()


@router.post("/platform-channels", response_model=PlatformChannelResponse, status_code=status.HTTP_201_CREATED, dependencies=[superadmin_dep])
async def create_platform_channel(data: PlatformChannelCreate, db: DbSession):
    channel = PlatformChannel(
        channel_type=data.channel_type,
        name=data.name,
        config=data.config or {},
        is_active=data.is_active,
    )
    db.add(channel)
    await db.flush()
    return channel


# ── Skills/Modules ──


@router.get("/skills", response_model=list[SkillResponse], dependencies=[superadmin_dep])
async def list_skills(db: DbSession):
    result = await db.execute(select(Skill).order_by(Skill.name))
    return result.scalars().all()


@router.put("/skills/{skill_id}/toggle", response_model=SkillResponse, dependencies=[superadmin_dep])
async def toggle_skill(skill_id: uuid.UUID, db: DbSession):
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")
    skill.is_active = not skill.is_active
    await db.flush()
    return skill


# ── Audit Logs ──


@router.get("/logs", response_model=list[AuditLogResponse], dependencies=[superadmin_dep])
async def list_audit_logs(db: DbSession, skip: int = 0, limit: int = 100):
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)
    )
    return result.scalars().all()
