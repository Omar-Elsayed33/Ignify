import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.db.models import (
    AIProvider,
    CreditBalance,
    Plan,
    ProviderType,
    Skill,
    Tenant,
    User,
    UserRole,
)


async def seed_plans(db: AsyncSession) -> dict[str, uuid.UUID]:
    existing = await db.execute(select(Plan).limit(1))
    if existing.scalar_one_or_none():
        plans = await db.execute(select(Plan))
        return {p.slug: p.id for p in plans.scalars().all()}

    plans_data = [
        Plan(
            name="Starter",
            slug="starter",
            max_users=3,
            max_channels=2,
            max_credits=500,
            price_monthly=0,
            features={"analytics": False, "ai_assistant": True, "seo": False},
        ),
        Plan(
            name="Professional",
            slug="professional",
            max_users=10,
            max_channels=5,
            max_credits=5000,
            price_monthly=49.99,
            features={"analytics": True, "ai_assistant": True, "seo": True, "ads": True},
        ),
        Plan(
            name="Enterprise",
            slug="enterprise",
            max_users=100,
            max_channels=50,
            max_credits=50000,
            price_monthly=199.99,
            features={"analytics": True, "ai_assistant": True, "seo": True, "ads": True, "api_access": True, "white_label": True},
        ),
    ]
    for p in plans_data:
        db.add(p)
    await db.flush()
    return {p.slug: p.id for p in plans_data}


async def seed_superadmin(db: AsyncSession, plan_id: uuid.UUID) -> None:
    existing = await db.execute(select(User).where(User.email == "admin@ignify.com"))
    if existing.scalar_one_or_none():
        return

    tenant = Tenant(
        name="Ignify Platform",
        slug="ignify-platform",
        plan_id=plan_id,
        is_active=True,
    )
    db.add(tenant)
    await db.flush()

    user = User(
        tenant_id=tenant.id,
        email="admin@ignify.com",
        password_hash=hash_password("Admin@2024"),
        full_name="Super Admin",
        role=UserRole.superadmin,
        is_active=True,
    )
    db.add(user)

    balance = CreditBalance(tenant_id=tenant.id, balance=99999)
    db.add(balance)
    await db.flush()


async def seed_ai_providers(db: AsyncSession) -> None:
    existing = await db.execute(select(AIProvider).limit(1))
    if existing.scalar_one_or_none():
        return

    providers = [
        AIProvider(
            name="OpenAI",
            slug="openai",
            provider_type=ProviderType.openai,
            api_base_url="https://api.openai.com/v1",
            default_model="gpt-4o",
            is_active=True,
            is_default=True,
        ),
        AIProvider(
            name="Anthropic",
            slug="anthropic",
            provider_type=ProviderType.anthropic,
            api_base_url="https://api.anthropic.com/v1",
            default_model="claude-sonnet-4-20250514",
            is_active=True,
            is_default=False,
        ),
        AIProvider(
            name="Google",
            slug="google",
            provider_type=ProviderType.google,
            api_base_url="https://generativelanguage.googleapis.com/v1",
            default_model="gemini-2.0-flash",
            is_active=True,
            is_default=False,
        ),
    ]
    for p in providers:
        db.add(p)
    await db.flush()


async def seed_skills(db: AsyncSession) -> None:
    existing = await db.execute(select(Skill).limit(1))
    if existing.scalar_one_or_none():
        return

    skills = [
        Skill(
            name="Customer Support",
            slug="customer-support",
            description="AI-powered customer support with FAQ, ticket creation, and escalation",
            category="support",
            icon="headset",
            prompt_template="You are a helpful customer support agent for {brand_name}. Answer questions politely and accurately.",
            tools=[{"name": "search_faq", "type": "function"}, {"name": "create_ticket", "type": "function"}],
            config_schema={"faq_source": "string", "escalation_email": "string"},
        ),
        Skill(
            name="Content Writer",
            slug="content-writer",
            description="Generate blog posts, social media content, and marketing copy",
            category="content",
            icon="edit",
            prompt_template="You are a skilled content writer for {brand_name}. Write in the brand voice: {brand_voice}.",
            tools=[{"name": "generate_content", "type": "function"}, {"name": "optimize_seo", "type": "function"}],
            config_schema={"default_tone": "string", "max_length": "integer"},
        ),
        Skill(
            name="Lead Qualifier",
            slug="lead-qualifier",
            description="Qualify leads through conversational AI, score them, and route to sales",
            category="sales",
            icon="target",
            prompt_template="You are a lead qualification assistant for {brand_name}. Ask relevant questions to qualify the lead.",
            tools=[{"name": "score_lead", "type": "function"}, {"name": "assign_lead", "type": "function"}],
            config_schema={"qualification_criteria": "object", "auto_assign": "boolean"},
        ),
        Skill(
            name="SEO Advisor",
            slug="seo-advisor",
            description="Analyze keywords, suggest optimizations, and track rankings",
            category="seo",
            icon="search",
            prompt_template="You are an SEO expert. Provide actionable SEO advice based on current data.",
            tools=[{"name": "keyword_research", "type": "function"}, {"name": "site_audit", "type": "function"}],
            config_schema={"target_region": "string"},
        ),
        Skill(
            name="Ad Campaign Manager",
            slug="ad-campaign-manager",
            description="Create, optimize, and analyze ad campaigns across platforms",
            category="ads",
            icon="megaphone",
            prompt_template="You are an advertising expert. Help create and optimize ad campaigns for {brand_name}.",
            tools=[{"name": "create_campaign", "type": "function"}, {"name": "analyze_performance", "type": "function"}],
            config_schema={"default_budget": "number", "platforms": "array"},
        ),
        Skill(
            name="Social Media Manager",
            slug="social-media-manager",
            description="Schedule posts, engage with audience, and track social metrics",
            category="social",
            icon="share",
            prompt_template="You are a social media manager for {brand_name}. Create engaging posts that match the brand voice.",
            tools=[{"name": "schedule_post", "type": "function"}, {"name": "analyze_engagement", "type": "function"}],
            config_schema={"posting_schedule": "object", "hashtag_strategy": "string"},
        ),
        Skill(
            name="Analytics Reporter",
            slug="analytics-reporter",
            description="Generate marketing analytics reports and insights",
            category="analytics",
            icon="chart",
            prompt_template="You are a marketing analytics expert. Provide clear, data-driven insights.",
            tools=[{"name": "generate_report", "type": "function"}, {"name": "trend_analysis", "type": "function"}],
            config_schema={"report_frequency": "string"},
        ),
        Skill(
            name="Competitor Analyst",
            slug="competitor-analyst",
            description="Monitor competitors and provide competitive intelligence",
            category="research",
            icon="eye",
            prompt_template="You are a competitive intelligence analyst. Monitor and analyze competitor activities.",
            tools=[{"name": "track_competitor", "type": "function"}, {"name": "compare_metrics", "type": "function"}],
            config_schema={"tracking_frequency": "string"},
        ),
    ]
    for s in skills:
        db.add(s)
    await db.flush()


async def run_seed(db: AsyncSession) -> None:
    plan_ids = await seed_plans(db)
    await seed_superadmin(db, plan_ids.get("enterprise", list(plan_ids.values())[0]))
    await seed_ai_providers(db)
    await seed_skills(db)
    await db.commit()
