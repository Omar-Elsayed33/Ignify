from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.database import engine
from app.db.models import Base


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

# Mount all routers
from app.modules.admin.router import router as admin_router
from app.modules.ads.router import router as ads_router
from app.modules.analytics.router import router as analytics_router
from app.modules.assistant.router import router as assistant_router
from app.modules.auth.router import router as auth_router
from app.modules.billing.router import router as billing_router
from app.modules.campaigns.router import router as campaigns_router
from app.modules.channels.router import router as channels_router
from app.modules.competitors.router import router as competitors_router
from app.modules.content.router import router as content_router
from app.modules.conversations.router import router as conversations_router
from app.modules.creative.router import router as creative_router
from app.modules.integrations.router import router as integrations_router
from app.modules.leads.router import router as leads_router
from app.modules.seo.router import router as seo_router
from app.modules.social.router import router as social_router
from app.modules.tenants.router import router as tenants_router
from app.modules.users.router import router as users_router

prefix = settings.API_V1_PREFIX

app.include_router(auth_router, prefix=prefix)
app.include_router(tenants_router, prefix=prefix)
app.include_router(users_router, prefix=prefix)
app.include_router(channels_router, prefix=prefix)
app.include_router(conversations_router, prefix=prefix)
app.include_router(content_router, prefix=prefix)
app.include_router(creative_router, prefix=prefix)
app.include_router(ads_router, prefix=prefix)
app.include_router(seo_router, prefix=prefix)
app.include_router(social_router, prefix=prefix)
app.include_router(leads_router, prefix=prefix)
app.include_router(campaigns_router, prefix=prefix)
app.include_router(analytics_router, prefix=prefix)
app.include_router(competitors_router, prefix=prefix)
app.include_router(integrations_router, prefix=prefix)
app.include_router(assistant_router, prefix=prefix)
app.include_router(billing_router, prefix=prefix)
app.include_router(admin_router, prefix=prefix)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": settings.APP_NAME}
