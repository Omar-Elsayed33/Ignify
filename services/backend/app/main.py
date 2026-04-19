from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging import setup_logging
from app.db.database import engine
from app.db.models import Base

# ─── Observability: Sentry (must init before app creation) ───
if settings.SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.SENTRY_ENVIRONMENT,
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
            integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        )
    except Exception:  # pragma: no cover
        pass

# ─── Structured logging (JSON in prod, human-readable in DEBUG) ───
setup_logging(settings.LOG_LEVEL, json_format=not settings.DEBUG)

# Structlog augment: enables `from app.core.logging_config import get_logger`
# with tenant_id/user_id/request_id contextvars for per-request correlation.
try:
    from app.core.logging_config import configure_logging as _configure_structlog
    _configure_structlog()
except Exception:  # pragma: no cover
    # structlog optional until dependencies are rebuilt; fall back to stdlib logging.
    pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables in dev mode
    if settings.DEBUG:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        # Run seed
        from app.db.database import async_session
        from app.db.seed import run_seed

        async with async_session() as db:
            await run_seed(db)

        # Seed default plan mode configs if table is empty
        from app.agents.plan_modes import seed_default_mode_configs

        async with async_session() as db:
            await seed_default_mode_configs(db)

    yield

    # Shutdown
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered marketing SaaS platform",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def http_rate_limit(request, call_next):
    """Per-IP safety-net: 100 requests / minute across the entire backend.

    Fail-open if Redis is unavailable (matches ``check_rate_limit`` semantics).
    Skips ops/health probes so external monitors aren't throttled.
    """
    path = request.url.path or ""
    if path.startswith("/health") or path.startswith("/metrics") or path.startswith("/ops"):
        return await call_next(request)
    ip = request.client.host if request.client else "unknown"
    try:
        from fastapi import HTTPException

        from app.core.rate_limit import check_rate_limit

        await check_rate_limit(f"global-ip:{ip}", limit=100, window_seconds=60)
    except HTTPException as exc:
        from fastapi.responses import JSONResponse

        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    return await call_next(request)


@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.middleware("http")
async def custom_domain_tenant(request, call_next):
    """Map X-Forwarded-Host / Host to a tenant for public endpoints (white-label)."""
    try:
        host = (
            request.headers.get("x-forwarded-host")
            or request.headers.get("host")
            or ""
        ).split(",")[0].strip().lower().split(":")[0]
        if host and not host.endswith("ignify.app") and not host.startswith("localhost"):
            from app.db.database import async_session
            from app.modules.white_label.service import find_tenant_by_domain

            async with async_session() as db:
                tid = await find_tenant_by_domain(db, host)
                if tid:
                    request.state.white_label_tenant_id = str(tid)
                    request.state.white_label_host = host
    except Exception:  # pragma: no cover - best effort
        pass
    return await call_next(request)

# Mount all routers
from app.modules.admin.router import router as admin_router
from app.modules.agent_configs.router import router as agent_configs_router
from app.modules.ads.router import router as ads_router
from app.modules.analytics.router import router as analytics_router
from app.modules.analytics_dashboard.router import router as analytics_dashboard_router
from app.modules.assistant.router import router as assistant_router
from app.modules.auth.router import router as auth_router
from app.modules.billing.router import router as billing_router
from app.modules.campaigns.router import router as campaigns_router
from app.modules.channels.router import router as channels_router
from app.modules.competitors.router import router as competitors_router
from app.modules.content.router import router as content_router
from app.modules.content_gen.router import router as content_gen_router
from app.modules.content_templates.router import router as content_templates_router
from app.modules.creative_gen.router import router as creative_gen_router
from app.modules.video_gen.router import router as video_gen_router
from app.modules.inbox.router import router as inbox_router
from app.modules.knowledge.router import router as knowledge_router
from app.modules.conversations.router import router as conversations_router
from app.modules.creative.router import router as creative_router
from app.modules.integrations.router import router as integrations_router
from app.modules.leads.router import router as leads_router
from app.modules.public_leads.router import router as public_leads_router
from app.modules.onboarding.router import router as onboarding_router
from app.modules.tenant_settings.router import router as tenant_settings_router
from app.modules.ops.router import router as ops_router
from app.modules.plans.router import router as plans_router
from app.modules.seo.router import router as seo_router
from app.modules.social.router import router as social_router
from app.modules.social_scheduler.router import router as social_scheduler_router
from app.modules.team.router import router as team_router
from app.modules.tenants.router import router as tenants_router
from app.modules.users.router import router as users_router
from app.modules.webhooks.meta import router as webhooks_router
from app.modules.experiments.router import router as experiments_router
from app.modules.geo.router import router as geo_router
from app.modules.white_label.router import router as white_label_router
from app.modules.ai_assistant.router import router as ai_assistant_router
from app.modules.media.router import router as media_router
from app.modules.feedback.router import router as feedback_router
from app.modules.plan_versioning.router import router as plan_versioning_router
from app.modules.plan_share.router import router as plan_share_router
from app.modules.plan_share.router import public_router as plan_share_public_router
from app.modules.referrals.router import router as referrals_router
from app.modules.api_keys.router import router as api_keys_router
from app.modules.webhook_subscriptions.router import router as webhook_subs_router
from app.modules.ai_usage.router import router as ai_usage_router

prefix = settings.API_V1_PREFIX

app.include_router(auth_router, prefix=prefix)
app.include_router(tenants_router, prefix=prefix)
app.include_router(users_router, prefix=prefix)
app.include_router(team_router, prefix=prefix)
app.include_router(channels_router, prefix=prefix)
app.include_router(conversations_router, prefix=prefix)
app.include_router(content_router, prefix=prefix)
app.include_router(creative_router, prefix=prefix)
app.include_router(ads_router, prefix=prefix)
app.include_router(seo_router, prefix=prefix)
app.include_router(social_router, prefix=prefix)
app.include_router(social_scheduler_router, prefix=prefix)
app.include_router(public_leads_router, prefix=prefix)
app.include_router(leads_router, prefix=prefix)
app.include_router(campaigns_router, prefix=prefix)
app.include_router(analytics_router, prefix=prefix)
app.include_router(analytics_dashboard_router, prefix=prefix)
app.include_router(competitors_router, prefix=prefix)
app.include_router(integrations_router, prefix=prefix)
app.include_router(assistant_router, prefix=prefix)
app.include_router(billing_router, prefix=prefix)
app.include_router(admin_router, prefix=prefix)
app.include_router(agent_configs_router, prefix=prefix)
app.include_router(plans_router, prefix=prefix)
app.include_router(onboarding_router, prefix=prefix)
app.include_router(tenant_settings_router, prefix=prefix)
app.include_router(content_gen_router, prefix=prefix)
app.include_router(content_templates_router, prefix=prefix)
app.include_router(creative_gen_router, prefix=prefix)
app.include_router(video_gen_router, prefix=prefix)
app.include_router(inbox_router, prefix=prefix)
app.include_router(knowledge_router, prefix=prefix)
app.include_router(webhooks_router, prefix=prefix)
app.include_router(experiments_router, prefix=prefix)
app.include_router(geo_router, prefix=prefix)
app.include_router(white_label_router, prefix=prefix)
app.include_router(ai_assistant_router, prefix=prefix)
app.include_router(media_router, prefix=prefix)
app.include_router(feedback_router, prefix=prefix)
app.include_router(plan_versioning_router, prefix=prefix)
app.include_router(plan_share_router, prefix=prefix)
app.include_router(plan_share_public_router, prefix=prefix)
app.include_router(referrals_router, prefix=prefix)
app.include_router(api_keys_router, prefix=prefix)
app.include_router(webhook_subs_router, prefix=prefix)
app.include_router(ai_usage_router, prefix=prefix)

# Ops endpoints mounted at root so external probes don't need /api/v1.
app.include_router(ops_router)

# Ensure agents are registered via import side-effects
# Use `from ... import` to avoid shadowing the FastAPI `app` variable above.
from app.agents import strategy as _strategy  # noqa: E402,F401
from app.agents import content as _content  # noqa: E402,F401
from app.agents import creative as _creative  # noqa: E402,F401
from app.agents import video as _video  # noqa: E402,F401
from app.agents import inbox as _inbox  # noqa: E402,F401
from app.agents import analytics as _analytics  # noqa: E402,F401
from app.agents import lead as _lead  # noqa: E402,F401
from app.agents import ads as _ads  # noqa: E402,F401
from app.agents import seo as _seo  # noqa: E402,F401
from app.agents import competitor as _competitor  # noqa: E402,F401


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": settings.APP_NAME}
