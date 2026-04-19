import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select

from app.core.config import settings
from app.db.models import (
    AIProvider,
    AgentRun,
    AuditLog,
    Campaign,
    CampaignStatus,
    Channel,
    MarketingPlan,
    Message,
    OfflinePayment,
    Plan,
    PlanModeConfig,
    PlatformChannel,
    Skill,
    Tenant,
    TenantAgentConfig,
    User,
    UserRole,
)
from app.dependencies import DbSession, require_role
from app.modules.admin.schemas import (
    AIProviderCreate,
    AIProviderResponse,
    AgentGraphResponse,
    AgentListItem,
    AgentRunAdminItem,
    AgentRunDetailResponse,
    AuditLogResponse,
    CostByAgentItem,
    CostByTenantItem,
    CostStatsResponse,
    DashboardStatsResponse,
    GlobalSettingsResponse,
    MarketingPlanAdminItem,
    PlanAdminCreate,
    PlanAdminResponse,
    PlanAdminUpdate,
    PlanModeConfigItem,
    PlanModeConfigUpdate,
    PlatformChannelCreate,
    PlatformChannelResponse,
    SkillResponse,
    OfflinePaymentAdminResponse,
    OfflinePaymentReview,
    TenantAdminResponse,
    TenantAdminUpdate,
    TenantAgentConfigAdminItem,
    TenantAgentConfigUpdate,
    TenantDetailResponse,
    TenantPlanUpdate,
    TenantSubscriptionUpdate,
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


# ── Marketing Plans (cross-tenant monitoring) ──


@router.get("/marketing-plans", response_model=list[MarketingPlanAdminItem], dependencies=[superadmin_dep])
async def list_all_marketing_plans(db: DbSession, skip: int = 0, limit: int = 50):
    stmt = (
        select(MarketingPlan, Tenant.name)
        .join(Tenant, Tenant.id == MarketingPlan.tenant_id)
        .order_by(MarketingPlan.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    items: list[MarketingPlanAdminItem] = []
    for plan, tenant_name in result.all():
        items.append(
            MarketingPlanAdminItem(
                id=plan.id,
                tenant_id=plan.tenant_id,
                tenant_name=tenant_name,
                title=plan.title,
                status=plan.status,
                version=plan.version,
                created_at=plan.created_at,
            )
        )
    return items


# ── Agent Runs (cross-tenant monitoring) ──


@router.get("/agent-runs", response_model=list[AgentRunAdminItem], dependencies=[superadmin_dep])
async def list_all_agent_runs(
    db: DbSession,
    agent_name: Optional[str] = Query(default=None),
    skip: int = 0,
    limit: int = 50,
):
    stmt = (
        select(AgentRun, Tenant.name)
        .join(Tenant, Tenant.id == AgentRun.tenant_id)
        .order_by(AgentRun.started_at.desc())
        .offset(skip)
        .limit(limit)
    )
    if agent_name:
        stmt = stmt.where(AgentRun.agent_name == agent_name)
    result = await db.execute(stmt)
    items: list[AgentRunAdminItem] = []
    for run, tenant_name in result.all():
        items.append(
            AgentRunAdminItem(
                id=run.id,
                tenant_id=run.tenant_id,
                tenant_name=tenant_name,
                agent_name=run.agent_name,
                model=run.model,
                status=run.status,
                cost_usd=float(run.cost_usd) if run.cost_usd is not None else None,
                latency_ms=run.latency_ms,
                started_at=run.started_at,
            )
        )
    return items


# ── Tenant Detail & Drilldowns ──


@router.get("/tenants/{tenant_id}/detail", response_model=TenantDetailResponse, dependencies=[superadmin_dep])
async def get_tenant_detail(tenant_id: uuid.UUID, db: DbSession):
    tenant = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    plan_name = None
    if tenant.plan_id:
        plan_name = (await db.execute(select(Plan.name).where(Plan.id == tenant.plan_id))).scalar_one_or_none()

    user_count = (await db.execute(select(func.count(User.id)).where(User.tenant_id == tenant_id))).scalar() or 0
    plan_count = (await db.execute(select(func.count(MarketingPlan.id)).where(MarketingPlan.tenant_id == tenant_id))).scalar() or 0
    agent_run_count = (await db.execute(select(func.count(AgentRun.id)).where(AgentRun.tenant_id == tenant_id))).scalar() or 0

    onboarding_completed = bool((tenant.config or {}).get("onboarding_completed", False))

    return TenantDetailResponse(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        plan_name=plan_name,
        is_active=tenant.is_active,
        user_count=int(user_count),
        plan_count=int(plan_count),
        agent_run_count=int(agent_run_count),
        created_at=tenant.created_at,
        onboarding_completed=onboarding_completed,
    )


@router.get("/tenants/{tenant_id}/plans", response_model=list[MarketingPlanAdminItem], dependencies=[superadmin_dep])
async def get_tenant_plans(tenant_id: uuid.UUID, db: DbSession, skip: int = 0, limit: int = 50):
    tenant = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    result = await db.execute(
        select(MarketingPlan)
        .where(MarketingPlan.tenant_id == tenant_id)
        .order_by(MarketingPlan.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    plans = result.scalars().all()
    return [
        MarketingPlanAdminItem(
            id=p.id,
            tenant_id=p.tenant_id,
            tenant_name=tenant.name,
            title=p.title,
            status=p.status,
            version=p.version,
            created_at=p.created_at,
        )
        for p in plans
    ]


@router.get("/tenants/{tenant_id}/agent-runs", response_model=list[AgentRunAdminItem], dependencies=[superadmin_dep])
async def get_tenant_agent_runs(tenant_id: uuid.UUID, db: DbSession, skip: int = 0, limit: int = 50):
    tenant = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    result = await db.execute(
        select(AgentRun)
        .where(AgentRun.tenant_id == tenant_id)
        .order_by(AgentRun.started_at.desc())
        .offset(skip)
        .limit(limit)
    )
    runs = result.scalars().all()
    return [
        AgentRunAdminItem(
            id=r.id,
            tenant_id=r.tenant_id,
            tenant_name=tenant.name,
            agent_name=r.agent_name,
            model=r.model,
            status=r.status,
            cost_usd=float(r.cost_usd) if r.cost_usd is not None else None,
            latency_ms=r.latency_ms,
            started_at=r.started_at,
        )
        for r in runs
    ]


@router.get(
    "/tenants/{tenant_id}/agent-configs",
    response_model=list[TenantAgentConfigAdminItem],
    dependencies=[superadmin_dep],
)
async def get_tenant_agent_configs(tenant_id: uuid.UUID, db: DbSession):
    from app.agents.models import AGENT_MODELS

    result = await db.execute(select(TenantAgentConfig).where(TenantAgentConfig.tenant_id == tenant_id))
    overrides = {c.agent_name: c for c in result.scalars().all()}

    items: list[TenantAgentConfigAdminItem] = []
    for agent_name, default_model in AGENT_MODELS.items():
        cfg = overrides.get(agent_name)
        if cfg:
            items.append(
                TenantAgentConfigAdminItem(
                    tenant_id=tenant_id,
                    agent_name=agent_name,
                    model=cfg.model or default_model,
                    is_enabled=cfg.is_enabled,
                    system_prompt_set=bool(cfg.system_prompt),
                    temperature=cfg.temperature,
                )
            )
        else:
            items.append(
                TenantAgentConfigAdminItem(
                    tenant_id=tenant_id,
                    agent_name=agent_name,
                    model=default_model,
                    is_enabled=True,
                    system_prompt_set=False,
                    temperature=None,
                )
            )
    return items


@router.put(
    "/tenants/{tenant_id}/agent-configs/{agent_name}",
    response_model=TenantAgentConfigAdminItem,
    dependencies=[superadmin_dep],
)
async def upsert_tenant_agent_config(
    tenant_id: uuid.UUID,
    agent_name: str,
    data: TenantAgentConfigUpdate,
    db: DbSession,
):
    from app.agents.models import AGENT_MODELS

    tenant = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    result = await db.execute(
        select(TenantAgentConfig).where(
            TenantAgentConfig.tenant_id == tenant_id,
            TenantAgentConfig.agent_name == agent_name,
        )
    )
    cfg = result.scalar_one_or_none()
    if cfg is None:
        cfg = TenantAgentConfig(tenant_id=tenant_id, agent_name=agent_name)
        db.add(cfg)

    payload = data.model_dump(exclude_unset=True)
    for field, value in payload.items():
        setattr(cfg, field, value)
    await db.flush()

    default_model = AGENT_MODELS.get(agent_name, "anthropic/claude-sonnet-4-5")
    return TenantAgentConfigAdminItem(
        tenant_id=tenant_id,
        agent_name=agent_name,
        model=cfg.model or default_model,
        is_enabled=cfg.is_enabled,
        system_prompt_set=bool(cfg.system_prompt),
        temperature=cfg.temperature,
    )


# ── Global Settings (flags only — never returns raw keys) ──


@router.get("/settings", response_model=GlobalSettingsResponse, dependencies=[superadmin_dep])
async def get_global_settings():
    return GlobalSettingsResponse(
        openrouter_api_key_set=bool(settings.OPENROUTER_API_KEY),
        openrouter_base_url=settings.OPENROUTER_BASE_URL,
        replicate_token_set=bool(settings.REPLICATE_API_TOKEN),
        elevenlabs_key_set=bool(settings.ELEVENLABS_API_KEY),
        stripe_key_set=bool(settings.STRIPE_SECRET_KEY),
        paymob_configured=bool(settings.PAYMOB_API_KEY and settings.PAYMOB_INTEGRATION_ID),
        paytabs_configured=bool(settings.PAYTABS_PROFILE_ID and settings.PAYTABS_SERVER_KEY),
        geidea_configured=bool(settings.GEIDEA_MERCHANT_ID and settings.GEIDEA_API_PASSWORD),
        email_verification_required=bool(settings.EMAIL_VERIFICATION_REQUIRED),
    )


# ── Cost Stats ──


@router.get("/stats/cost", response_model=CostStatsResponse, dependencies=[superadmin_dep])
async def cost_stats(db: DbSession, days: int = 30):
    since = datetime.now(timezone.utc) - timedelta(days=days)

    by_agent_rows = (
        await db.execute(
            select(
                AgentRun.agent_name,
                func.coalesce(func.sum(AgentRun.cost_usd), 0).label("total"),
                func.count(AgentRun.id).label("cnt"),
            )
            .where(AgentRun.started_at >= since)
            .group_by(AgentRun.agent_name)
            .order_by(func.sum(AgentRun.cost_usd).desc())
        )
    ).all()

    by_tenant_rows = (
        await db.execute(
            select(
                AgentRun.tenant_id,
                Tenant.name,
                func.coalesce(func.sum(AgentRun.cost_usd), 0).label("total"),
                func.count(AgentRun.id).label("cnt"),
            )
            .join(Tenant, Tenant.id == AgentRun.tenant_id)
            .where(AgentRun.started_at >= since)
            .group_by(AgentRun.tenant_id, Tenant.name)
            .order_by(func.sum(AgentRun.cost_usd).desc())
        )
    ).all()

    by_agent = [
        CostByAgentItem(agent_name=row[0], total_cost_usd=float(row[1] or 0), run_count=int(row[2] or 0))
        for row in by_agent_rows
    ]
    by_tenant = [
        CostByTenantItem(tenant_id=row[0], tenant_name=row[1], total_cost_usd=float(row[2] or 0), run_count=int(row[3] or 0))
        for row in by_tenant_rows
    ]
    total = sum(item.total_cost_usd for item in by_agent)

    return CostStatsResponse(by_agent=by_agent, by_tenant=by_tenant, total_cost_usd=total)


# ── Agents: Graph Introspection ──


_FAKE_TENANT_ID = "00000000-0000-0000-0000-000000000000"


def _introspect_agent(name: str, cls) -> AgentListItem:
    """Best-effort introspection of an agent class.

    We instantiate with a fake tenant id and call `.build_graph()` to extract
    sub-agent node names. Any failure falls back to metadata-only info.
    """
    from app.agents.models import AGENT_MODELS, MODEL_TIERS

    default_model = AGENT_MODELS.get(name, MODEL_TIERS["balanced"])
    description = (cls.__doc__ or cls.system_prompt or "").strip().split("\n")[0][:240]
    sub_agents: list[str] = []
    try:
        agent = cls(tenant_id=_FAKE_TENANT_ID)
        graph = agent.build_graph()
        g = graph.get_graph()
        for node_name in g.nodes:  # type: ignore[attr-defined]
            if node_name in ("__start__", "__end__"):
                continue
            sub_agents.append(str(node_name))
    except Exception:
        pass
    return AgentListItem(
        name=name,
        default_model=default_model,
        description=description or None,
        sub_agents=sub_agents,
    )


@router.get("/agents/list", response_model=list[AgentListItem], dependencies=[superadmin_dep])
async def list_agents():
    from app.agents.registry import AGENT_REGISTRY

    return [_introspect_agent(name, cls) for name, cls in AGENT_REGISTRY.items()]


@router.get("/agents/{name}/graph", response_model=AgentGraphResponse, dependencies=[superadmin_dep])
async def get_agent_graph(name: str):
    from app.agents.registry import AGENT_REGISTRY, get_agent

    if name not in AGENT_REGISTRY:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown agent: {name}")

    nodes: list[str] = []
    edges: list[dict] = []
    mermaid = ""
    raw: dict | None = None

    try:
        agent = get_agent(name, tenant_id=_FAKE_TENANT_ID)
        compiled = agent.build_graph()
        g = compiled.get_graph()

        for node_name in g.nodes:  # type: ignore[attr-defined]
            nodes.append(str(node_name))
        for edge in g.edges:  # type: ignore[attr-defined]
            src = getattr(edge, "source", None)
            tgt = getattr(edge, "target", None)
            if src is None and isinstance(edge, tuple) and len(edge) >= 2:
                src, tgt = edge[0], edge[1]
            edges.append({
                "source": str(src) if src is not None else "",
                "target": str(tgt) if tgt is not None else "",
                "conditional": bool(getattr(edge, "conditional", False)),
            })

        try:
            mermaid = g.draw_mermaid()
        except Exception:
            mermaid = ""

        try:
            raw_json = g.to_json() if hasattr(g, "to_json") else None
            if raw_json is not None:
                raw = raw_json if isinstance(raw_json, dict) else {"graph": raw_json}
        except Exception:
            raw = None
    except Exception as e:
        # Fallback: synthesize a minimal mermaid from whatever we have
        mermaid = mermaid or f"graph TD\n    error[\"Failed to introspect: {str(e)[:120]}\"]"

    if not mermaid:
        lines = ["graph TD"]
        for n in nodes:
            safe = n.replace('"', "'")
            lines.append(f'    {n}["{safe}"]')
        for e in edges:
            lines.append(f'    {e["source"]} --> {e["target"]}')
        mermaid = "\n".join(lines)

    return AgentGraphResponse(name=name, mermaid=mermaid, nodes=nodes, edges=edges, raw=raw)


# ── Agent Run Detail ──


@router.get("/agent-runs/{run_id}", response_model=AgentRunDetailResponse, dependencies=[superadmin_dep])
async def get_agent_run_detail(run_id: uuid.UUID, db: DbSession):
    row = (
        await db.execute(
            select(AgentRun, Tenant.name)
            .join(Tenant, Tenant.id == AgentRun.tenant_id)
            .where(AgentRun.id == run_id)
        )
    ).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent run not found")
    run, tenant_name = row

    output = run.output or {}
    traces = []
    output_clean: dict | None = None
    if isinstance(output, dict):
        traces = output.get("_traces") or []
        output_clean = {k: v for k, v in output.items() if k != "_traces"}
    else:
        output_clean = output

    return AgentRunDetailResponse(
        id=run.id,
        tenant_id=run.tenant_id,
        tenant_name=tenant_name,
        agent_name=run.agent_name,
        model=run.model,
        status=run.status,
        input=run.input,
        output=output_clean,
        traces=traces if isinstance(traces, list) else [],
        error=run.error,
        input_tokens=run.input_tokens,
        output_tokens=run.output_tokens,
        cost_usd=float(run.cost_usd) if run.cost_usd is not None else None,
        latency_ms=run.latency_ms,
        started_at=run.started_at,
        finished_at=run.finished_at,
    )


# ── Plans Management ──


def _plan_to_admin(plan: Plan) -> PlanAdminResponse:
    features = plan.features or {}
    # features column historically stores metadata blob; expose whole dict.
    feat = features if isinstance(features, dict) else {"features": features}
    return PlanAdminResponse(
        id=plan.id,
        slug=plan.slug,
        name=plan.name,
        prices=plan.prices or {},
        features=feat,
        max_users=plan.max_users,
        max_channels=plan.max_channels,
        max_credits=plan.max_credits,
        is_active=plan.is_active,
    )


@router.get("/plans", response_model=list[PlanAdminResponse], dependencies=[superadmin_dep])
async def admin_list_plans(db: DbSession):
    result = await db.execute(select(Plan).order_by(Plan.price_monthly.asc()))
    return [_plan_to_admin(p) for p in result.scalars().all()]


@router.post(
    "/plans",
    response_model=PlanAdminResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[superadmin_dep],
)
async def admin_create_plan(data: PlanAdminCreate, db: DbSession):
    existing = (
        await db.execute(select(Plan).where(Plan.slug == data.slug))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Plan slug already exists")
    # derive price_monthly (USD) for legacy compatibility
    usd_monthly = 0.0
    try:
        usd_monthly = float(((data.prices or {}).get("USD") or {}).get("monthly", 0))
    except Exception:
        usd_monthly = 0.0
    plan = Plan(
        name=data.name,
        slug=data.slug,
        max_users=data.max_users,
        max_channels=data.max_channels,
        max_credits=data.max_credits,
        price_monthly=usd_monthly,
        features=data.features or {},
        prices=data.prices or {},
        is_active=data.is_active,
    )
    db.add(plan)
    await db.flush()
    return _plan_to_admin(plan)


@router.patch("/plans/{plan_id}", response_model=PlanAdminResponse, dependencies=[superadmin_dep])
async def admin_update_plan(plan_id: uuid.UUID, data: PlanAdminUpdate, db: DbSession):
    plan = (
        await db.execute(select(Plan).where(Plan.id == plan_id))
    ).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    payload = data.model_dump(exclude_unset=True)
    for field, value in payload.items():
        setattr(plan, field, value)
    # keep legacy price_monthly in sync if USD monthly provided
    if "prices" in payload and isinstance(payload["prices"], dict):
        try:
            usd_monthly = float(((payload["prices"] or {}).get("USD") or {}).get("monthly", plan.price_monthly or 0))
            plan.price_monthly = usd_monthly
        except Exception:
            pass
    await db.flush()
    return _plan_to_admin(plan)


@router.delete("/plans/{plan_id}", response_model=PlanAdminResponse, dependencies=[superadmin_dep])
async def admin_delete_plan(plan_id: uuid.UUID, db: DbSession):
    """Soft delete: mark plan inactive."""
    plan = (
        await db.execute(select(Plan).where(Plan.id == plan_id))
    ).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    plan.is_active = False
    await db.flush()
    return _plan_to_admin(plan)


# ── Audit Logs ──


@router.get("/logs", response_model=list[AuditLogResponse], dependencies=[superadmin_dep])
async def list_audit_logs(db: DbSession, skip: int = 0, limit: int = 100):
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)
    )
    return result.scalars().all()


# ── Plan Mode Configuration ──


@router.get("/plan-modes", response_model=dict, dependencies=[superadmin_dep])
async def get_all_plan_modes(db: DbSession):
    """Return all mode configs grouped by mode: {fast: [...], medium: [...], deep: [...]}"""
    from app.agents.plan_modes import ALL_SUBAGENTS, DEFAULT_MODE_CONFIG

    result = await db.execute(select(PlanModeConfig).order_by(PlanModeConfig.mode, PlanModeConfig.subagent_name))
    rows = result.scalars().all()

    # Build output grouped by mode
    out: dict = {"fast": [], "medium": [], "deep": []}
    db_map: dict[str, dict[str, str]] = {}
    for row in rows:
        db_map.setdefault(row.mode, {})[row.subagent_name] = row.model

    for mode in ("fast", "medium", "deep"):
        defaults = DEFAULT_MODE_CONFIG.get(mode, {})
        overrides = db_map.get(mode, {})
        merged = {**defaults, **overrides}
        out[mode] = [{"subagent_name": s, "model": merged.get(s, "")} for s in ALL_SUBAGENTS]

    return out


@router.put("/plan-modes/{mode}", response_model=list[PlanModeConfigItem], dependencies=[superadmin_dep])
async def update_plan_mode(mode: str, data: PlanModeConfigUpdate, db: DbSession):
    """Update model assignments for a plan mode. Pass list of {subagent_name, model}."""
    if mode not in ("fast", "medium", "deep"):
        raise HTTPException(status_code=400, detail="mode must be fast | medium | deep")

    updated: list[PlanModeConfig] = []
    for item in data.assignments:
        subagent_name = item.get("subagent_name")
        model = item.get("model")
        if not subagent_name or not model:
            continue

        existing = (
            await db.execute(
                select(PlanModeConfig).where(
                    PlanModeConfig.mode == mode,
                    PlanModeConfig.subagent_name == subagent_name,
                )
            )
        ).scalar_one_or_none()

        if existing:
            existing.model = model
            updated.append(existing)
        else:
            cfg = PlanModeConfig(mode=mode, subagent_name=subagent_name, model=model)
            db.add(cfg)
            updated.append(cfg)

    await db.commit()
    for cfg in updated:
        await db.refresh(cfg)

    return updated


@router.post("/plan-modes/reset", response_model=dict, dependencies=[superadmin_dep])
async def reset_plan_modes(db: DbSession):
    """Delete all DB overrides and revert to hardcoded defaults."""
    from sqlalchemy import delete
    await db.execute(delete(PlanModeConfig))
    await db.commit()
    return {"ok": True, "message": "Plan mode configs reset to defaults"}


# ── Tenant plan & subscription management ──────────────────────────────────


@router.put(
    "/tenants/{tenant_id}/plan",
    response_model=TenantAdminResponse,
    dependencies=[superadmin_dep],
)
async def change_tenant_plan(tenant_id: uuid.UUID, data: TenantPlanUpdate, db: DbSession):
    """Admin sets a tenant's plan and optionally activates their subscription (no payment required)."""
    tenant = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    plan = (
        await db.execute(select(Plan).where(Plan.slug == data.plan_code, Plan.is_active == True))
    ).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    tenant.plan_id = plan.id
    if data.activate_subscription:
        tenant.subscription_active = True
    # Update OpenRouter key limit to match new plan
    try:
        from app.db.models import TenantOpenRouterConfig
        from app.modules.ai_usage.service import update_tenant_plan_limit
        await update_tenant_plan_limit(db, tenant_id, data.plan_code)
    except Exception:
        pass
    await db.commit()
    await db.refresh(tenant)
    return tenant


@router.put(
    "/tenants/{tenant_id}/subscription",
    response_model=TenantAdminResponse,
    dependencies=[superadmin_dep],
)
async def set_tenant_subscription(tenant_id: uuid.UUID, data: TenantSubscriptionUpdate, db: DbSession):
    """Admin manually activates or deactivates a tenant's subscription."""
    tenant = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    tenant.subscription_active = data.subscription_active
    await db.commit()
    await db.refresh(tenant)
    return tenant


# ── Offline payment management ─────────────────────────────────────────────


@router.get(
    "/payments/offline",
    response_model=list[OfflinePaymentAdminResponse],
    dependencies=[superadmin_dep],
)
async def list_offline_payments(db: DbSession, status_filter: Optional[str] = None):
    """List all offline payment requests. Filter by status=pending|approved|rejected."""
    q = select(OfflinePayment, Tenant.name.label("tenant_name"), Plan.name.label("plan_name")).join(
        Tenant, Tenant.id == OfflinePayment.tenant_id
    ).outerjoin(Plan, Plan.id == OfflinePayment.plan_id)
    if status_filter:
        q = q.where(OfflinePayment.status == status_filter)
    q = q.order_by(OfflinePayment.created_at.desc())
    rows = (await db.execute(q)).all()
    result = []
    for payment, tenant_name, plan_name in rows:
        result.append(
            OfflinePaymentAdminResponse(
                id=payment.id,
                tenant_id=payment.tenant_id,
                tenant_name=tenant_name,
                plan_id=payment.plan_id,
                plan_name=plan_name,
                amount=float(payment.amount),
                currency=payment.currency,
                payment_method=payment.payment_method,
                reference_number=payment.reference_number,
                notes=payment.notes,
                status=payment.status,
                admin_notes=payment.admin_notes,
                reviewed_at=payment.reviewed_at,
                created_at=payment.created_at,
            )
        )
    return result


@router.post(
    "/payments/offline/{payment_id}/approve",
    response_model=OfflinePaymentAdminResponse,
    dependencies=[superadmin_dep],
)
async def approve_offline_payment(
    payment_id: uuid.UUID,
    data: OfflinePaymentReview,
    db: DbSession,
    current_user: User = Depends(require_role(UserRole.superadmin)),
):
    """Approve offline payment → activates tenant subscription and sets their plan."""
    payment = (
        await db.execute(select(OfflinePayment).where(OfflinePayment.id == payment_id))
    ).scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment.status != "pending":
        raise HTTPException(status_code=400, detail=f"Payment is already {payment.status}")

    payment.status = "approved"
    payment.admin_notes = data.admin_notes
    payment.reviewed_by_id = current_user.id
    payment.reviewed_at = datetime.now(timezone.utc)

    # Activate tenant subscription and apply plan
    tenant = (await db.execute(select(Tenant).where(Tenant.id == payment.tenant_id))).scalar_one_or_none()
    if tenant:
        tenant.subscription_active = True
        if payment.plan_id:
            tenant.plan_id = payment.plan_id
        # Update OpenRouter limit
        try:
            plan = (await db.execute(select(Plan).where(Plan.id == payment.plan_id))).scalar_one_or_none()
            if plan:
                from app.modules.ai_usage.service import update_tenant_plan_limit
                await update_tenant_plan_limit(db, tenant.id, plan.slug)
        except Exception:
            pass

    await db.commit()
    await db.refresh(payment)

    # Build response manually since we need join data
    tenant_name = tenant.name if tenant else "Unknown"
    plan = None
    if payment.plan_id:
        plan = (await db.execute(select(Plan).where(Plan.id == payment.plan_id))).scalar_one_or_none()

    return OfflinePaymentAdminResponse(
        id=payment.id,
        tenant_id=payment.tenant_id,
        tenant_name=tenant_name,
        plan_id=payment.plan_id,
        plan_name=plan.name if plan else None,
        amount=float(payment.amount),
        currency=payment.currency,
        payment_method=payment.payment_method,
        reference_number=payment.reference_number,
        notes=payment.notes,
        status=payment.status,
        admin_notes=payment.admin_notes,
        reviewed_at=payment.reviewed_at,
        created_at=payment.created_at,
    )


@router.post(
    "/payments/offline/{payment_id}/reject",
    response_model=OfflinePaymentAdminResponse,
    dependencies=[superadmin_dep],
)
async def reject_offline_payment(
    payment_id: uuid.UUID,
    data: OfflinePaymentReview,
    db: DbSession,
    current_user: User = Depends(require_role(UserRole.superadmin)),
):
    """Reject an offline payment request."""
    payment = (
        await db.execute(select(OfflinePayment).where(OfflinePayment.id == payment_id))
    ).scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment.status != "pending":
        raise HTTPException(status_code=400, detail=f"Payment is already {payment.status}")

    payment.status = "rejected"
    payment.admin_notes = data.admin_notes
    payment.reviewed_by_id = current_user.id
    payment.reviewed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(payment)

    tenant = (await db.execute(select(Tenant).where(Tenant.id == payment.tenant_id))).scalar_one_or_none()
    plan = None
    if payment.plan_id:
        plan = (await db.execute(select(Plan).where(Plan.id == payment.plan_id))).scalar_one_or_none()

    return OfflinePaymentAdminResponse(
        id=payment.id,
        tenant_id=payment.tenant_id,
        tenant_name=tenant.name if tenant else "Unknown",
        plan_id=payment.plan_id,
        plan_name=plan.name if plan else None,
        amount=float(payment.amount),
        currency=payment.currency,
        payment_method=payment.payment_method,
        reference_number=payment.reference_number,
        notes=payment.notes,
        status=payment.status,
        admin_notes=payment.admin_notes,
        reviewed_at=payment.reviewed_at,
        created_at=payment.created_at,
    )
