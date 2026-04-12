import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.db.models import (
    AIProvider,
    AssetType,
    Channel,
    ChannelStatus,
    ChannelType,
    ContentPost,
    ContentStatus,
    CreativeAsset,
    CreditBalance,
    Lead,
    LeadSource,
    LeadStatus,
    MarketingPlan,
    Message,
    MessageRole,
    Plan,
    PostType,
    ProviderType,
    Session,
    Skill,
    SocialAccount,
    SocialMetric,
    SocialPlatform,
    SocialPost,
    SocialPostStatus,
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


async def seed_test_customer(db: AsyncSession, plan_id: uuid.UUID) -> None:
    """Seed a ready-to-test customer tenant with owner user and completed onboarding."""
    existing = await db.execute(select(User).where(User.email == "customer@ignify.com"))
    if existing.scalar_one_or_none():
        return

    tenant = Tenant(
        name="Acme Marketing Demo",
        slug="acme-demo",
        plan_id=plan_id,
        is_active=True,
        config={
            "onboarding": {"completed": True, "step": 4},
            "onboarding_completed": True,
            "business_profile": {
                "industry": "ecommerce",
                "country": "EG",
                "primary_language": "ar",
                "description": "Online store selling handmade leather goods across the MENA region.",
                "target_audience": "Men and women 25-45, professionals, fashion-conscious, mid-to-high income",
                "products": ["Leather wallets", "Leather bags", "Belts", "Accessories"],
                "competitors": ["zara.com", "charleskeith.com"],
            },
            "knowledge_base": "We make premium handmade leather goods in Egypt since 2018. Shipping across MENA. 30-day return policy.",
        },
    )
    db.add(tenant)
    await db.flush()

    user = User(
        tenant_id=tenant.id,
        email="customer@ignify.com",
        password_hash=hash_password("Customer@2024"),
        full_name="Demo Customer",
        role=UserRole.owner,
        lang_preference="ar",
        is_active=True,
        email_verified=True,
        email_verified_at=datetime.now(timezone.utc),
    )
    db.add(user)

    balance = CreditBalance(tenant_id=tenant.id, balance=1000)
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
        Skill(name="Customer Support", slug="customer-support", description="AI-powered customer support with FAQ, ticket creation, and escalation", category="support", icon="headset", prompt_template="You are a helpful customer support agent for {brand_name}.", tools=[], config_schema={}),
        Skill(name="Content Writer", slug="content-writer", description="Generate blog posts, social media content, and marketing copy", category="content", icon="edit", prompt_template="You are a skilled content writer for {brand_name}.", tools=[], config_schema={}),
        Skill(name="Lead Qualifier", slug="lead-qualifier", description="Qualify leads through conversational AI, score them, and route to sales", category="sales", icon="target", prompt_template="You are a lead qualification assistant for {brand_name}.", tools=[], config_schema={}),
        Skill(name="SEO Advisor", slug="seo-advisor", description="Analyze keywords, suggest optimizations, and track rankings", category="seo", icon="search", prompt_template="You are an SEO expert.", tools=[], config_schema={}),
        Skill(name="Ad Campaign Manager", slug="ad-campaign-manager", description="Create, optimize, and analyze ad campaigns across platforms", category="ads", icon="megaphone", prompt_template="You are an advertising expert.", tools=[], config_schema={}),
        Skill(name="Social Media Manager", slug="social-media-manager", description="Schedule posts, engage with audience, and track social metrics", category="social", icon="share", prompt_template="You are a social media manager for {brand_name}.", tools=[], config_schema={}),
        Skill(name="Analytics Reporter", slug="analytics-reporter", description="Generate marketing analytics reports and insights", category="analytics", icon="chart", prompt_template="You are a marketing analytics expert.", tools=[], config_schema={}),
        Skill(name="Competitor Analyst", slug="competitor-analyst", description="Monitor competitors and provide competitive intelligence", category="research", icon="eye", prompt_template="You are a competitive intelligence analyst.", tools=[], config_schema={}),
    ]
    for s in skills:
        db.add(s)
    await db.flush()


# ────────────────────────────── Demo content ──────────────────────────────

async def _get_demo_tenant_user(db: AsyncSession) -> tuple[uuid.UUID, uuid.UUID] | None:
    res = await db.execute(select(User).where(User.email == "customer@ignify.com"))
    u = res.scalar_one_or_none()
    if not u or not u.tenant_id:
        return None
    return u.tenant_id, u.id


async def seed_demo_plan(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID) -> None:
    existing = await db.execute(select(MarketingPlan).where(MarketingPlan.tenant_id == tenant_id).limit(1))
    if existing.scalar_one_or_none():
        return

    today = date.today()
    personas = [
        {
            "name": "Layla, the urban professional",
            "age_range": "28-38",
            "goals": ["Premium daily-carry accessories", "Express personal style", "Durable quality"],
            "pains": ["Fast-fashion feels disposable", "Limited MENA-made premium options", "Sizing consistency"],
            "channels": ["instagram", "tiktok"],
        },
        {
            "name": "Omar, the gift buyer",
            "age_range": "30-50",
            "goals": ["Thoughtful corporate gifts", "Fast shipping across GCC", "Gift wrapping"],
            "pains": ["Generic gifts", "Slow cross-border delivery", "Lack of bulk discounts"],
            "channels": ["facebook", "google"],
        },
        {
            "name": "Sara, the fashion enthusiast",
            "age_range": "22-32",
            "goals": ["Unique statement pieces", "Support handmade brands", "Share looks online"],
            "pains": ["Mass-produced sameness", "High shipping fees", "Lack of AR arabic content"],
            "channels": ["instagram", "tiktok"],
        },
    ]

    channels = [
        {"name": "instagram", "priority": 1, "budget_share": 0.45, "notes": "Primary brand-building channel"},
        {"name": "tiktok", "priority": 2, "budget_share": 0.25, "notes": "Short-form reach for Gen-Z"},
        {"name": "facebook", "priority": 3, "budget_share": 0.15, "notes": "Gift-buyer & retargeting"},
        {"name": "google_ads", "priority": 4, "budget_share": 0.15, "notes": "High-intent search"},
    ]

    formats = ["reel", "carousel", "story", "post", "blog", "ad"]
    topics_ar = [
        "قصة حرفة الجلد اليدوي في مصر",
        "كيف تختار محفظة جلدية تدوم معك",
        "مجموعة رمضان الجديدة",
        "عرض خاص لأعضاء القائمة البريدية",
        "خلف الكواليس: ورشة أكمي",
        "دليل هدايا العيد للرجال",
        "أفضل حقيبة عمل للمرأة العصرية",
        "كيف تعتني بمنتجاتك الجلدية",
    ]
    topics_en = [
        "The story of handmade leather in Egypt",
        "How to choose a wallet that lasts a decade",
        "New Ramadan collection drop",
        "VIP early access for newsletter members",
        "Behind the scenes: inside the Acme workshop",
        "Eid gift guide for men",
        "The ultimate work tote for modern women",
        "Leather care 101: make it last forever",
    ]
    calendar = []
    for i in range(30):
        day = today + timedelta(days=i)
        ch = channels[i % len(channels)]["name"]
        fmt = formats[i % len(formats)]
        topic = (topics_ar + topics_en)[i % (len(topics_ar) + len(topics_en))]
        calendar.append({
            "day": day.isoformat(),
            "channel": ch,
            "format": fmt,
            "topic": topic,
            "hook": "حرفة يدوية. جلد طبيعي." if i % 2 == 0 else "Handcrafted. Heirloom leather.",
            "cta": "اشتري الآن" if i % 2 == 0 else "Shop the collection",
        })

    kpis = [
        {"name": "Instagram followers", "target": 50000, "current": 18200, "unit": "followers"},
        {"name": "Conversion rate", "target": 3.5, "current": 2.7, "unit": "%"},
        {"name": "Monthly revenue", "target": 250000, "current": 145000, "unit": "EGP"},
        {"name": "Average order value", "target": 1800, "current": 1420, "unit": "EGP"},
        {"name": "New B2B partners", "target": 10, "current": 2, "unit": "partners"},
        {"name": "Email open rate", "target": 28, "current": 22, "unit": "%"},
    ]

    market_analysis = {
        "summary": "Premium handmade leather goods in MENA has strong tailwinds from rising disposable income, a heritage-revival trend, and growing preference for locally-made craft. Main pressure comes from fast-fashion and grey-market imports.",
        "competitors": [
            {"name": "Charles & Keith", "positioning": "Affordable fashion leather", "strength": "Global supply chain", "weakness": "Not handmade / not local"},
            {"name": "Zara Accessories", "positioning": "Fast-fashion leather", "strength": "Distribution", "weakness": "Low durability, no story"},
            {"name": "Local Cairo artisan brands", "positioning": "Handmade premium", "strength": "Craft story", "weakness": "Weak digital marketing"},
        ],
        "swot": {
            "strengths": ["Handmade in Egypt heritage", "30-day return policy", "Strong brand story", "Premium raw material sourcing"],
            "weaknesses": ["Limited production capacity", "Higher price point", "Small social following vs global brands"],
            "opportunities": ["GCC expansion", "Corporate gifting B2B", "Ramadan & Eid seasonality", "TikTok Shop in MENA"],
            "threats": ["Currency volatility", "Cheap imports from Turkey/China", "Rising leather raw material cost"],
        },
        "trends": [
            "Heritage-revival and 'buy local' sentiment rising in MENA",
            "Short-form video (Reels/TikTok) driving discovery",
            "Corporate gifting B2B segment growing 18% YoY",
            "Sustainable / vegetable-tanned leather gaining traction",
        ],
    }

    plan = MarketingPlan(
        tenant_id=tenant_id,
        title="Q1 2026 Marketing Plan - Acme Leather",
        period_start=today,
        period_end=today + timedelta(days=90),
        goals=[
            "Reach 50K Instagram followers",
            "Increase website conversion rate by 30%",
            "Sign 10 new B2B partners across GCC",
        ],
        personas=personas,
        channels=channels,
        calendar=calendar,
        kpis=kpis,
        market_analysis=market_analysis,
        status="approved",
        version=1,
        created_by=user_id,
    )
    db.add(plan)
    await db.flush()


async def seed_demo_content(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID) -> None:
    existing = await db.execute(select(ContentPost).where(ContentPost.tenant_id == tenant_id).limit(1))
    if existing.scalar_one_or_none():
        return

    now = datetime.now(timezone.utc)
    posts = [
        ("مجموعة رمضان 2026: حرفة تستحق الانتظار",
         "أطلقنا مجموعة رمضان هذا العام بتصاميم مستوحاة من الأقواس الإسلامية. كل قطعة مصنوعة يدوياً في ورشتنا بالقاهرة.\n\nالمجموعة تتضمن محافظ، حقائب يد، وأحزمة بألوان الكراميل والأسود الكلاسيكي.\n\nاطلب الآن واستفد من الشحن المجاني داخل مصر ودول الخليج.",
         PostType.social, "instagram", ContentStatus.published, -5),
        ("The story behind every stitch",
         "Every Acme bag passes through seven artisans before it reaches you. We believe a product should outlive the trend it was born in. This is our story — 8 years, one workshop, and a love of natural leather.",
         PostType.blog, "blog", ContentStatus.published, -3),
        ("دليلك لاختيار المحفظة المثالية",
         "هل تعلم أن أكثر من 60% من الرجال يستخدمون نفس المحفظة لأكثر من 5 سنوات؟ في هذا الدليل نستعرض كيف تختار محفظة تناسب أسلوب حياتك.\n\n1- الحجم: قرر عدد البطاقات التي تحملها عادة.\n2- الجلد: الجلد الطبيعي يعيش أطول.\n3- الخياطة: اختر الخياطة اليدوية.",
         PostType.blog, "blog", ContentStatus.approved, -1),
        ("New Eid gift sets — limited run",
         "We only make 200 of these. Walnut leather gift box, with a custom-embossed wallet and keychain. Perfect for Eid.",
         PostType.social, "instagram", ContentStatus.scheduled, 2),
        ("خلف الكواليس — ورشة أكمي",
         "شاهد كيف نصنع حقيبة أكمي الأيقونية من جلد خام إلى قطعة فنية. فيديو قصير من ورشتنا في وسط القاهرة.",
         PostType.social, "instagram", ContentStatus.scheduled, 4),
        ("Behind the scenes: vegetable tanning",
         "Vegetable tanning takes 40 days. Chrome tanning takes 3. Here's why we wait the extra 37.",
         PostType.social, "facebook", ContentStatus.review, None),
        ("عرض خاص لأعضاء النشرة البريدية",
         "خصم 20% على المجموعة الكاملة لأعضاء القائمة البريدية فقط. العرض ساري لمدة 48 ساعة.",
         PostType.email, "email", ContentStatus.draft, None),
        ("Corporate gifting: bulk orders now open",
         "Give your team something they will keep for a decade. Our B2B bulk program opens this month. Minimum 25 units.",
         PostType.blog, "blog", ContentStatus.draft, None),
        ("كيف تعتني بمنتجاتك الجلدية",
         "ثلاث خطوات بسيطة لتحافظ على جلدك يعيش أطول: تنظيف، ترطيب، تخزين صحيح.",
         PostType.social, "instagram", ContentStatus.approved, 1),
        ("Fall-Winter 2026 teaser",
         "Something warm is coming. Camel, cognac, and deep burgundy. Launching October 1st.",
         PostType.ad_copy, "instagram", ContentStatus.draft, None),
    ]

    for title, body, ptype, platform, status, offset_days in posts:
        post = ContentPost(
            tenant_id=tenant_id,
            title=title,
            body=body,
            post_type=ptype,
            platform=platform,
            status=status,
            scheduled_at=(now + timedelta(days=offset_days)) if offset_days and offset_days > 0 else None,
            published_at=(now + timedelta(days=offset_days)) if offset_days and offset_days < 0 else None,
            metadata_={"demo": True},
        )
        db.add(post)
    await db.flush()


async def seed_demo_creatives(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID) -> None:
    existing = await db.execute(select(CreativeAsset).where(CreativeAsset.tenant_id == tenant_id).limit(1))
    if existing.scalar_one_or_none():
        return

    assets = [
        ("Ramadan collection hero", AssetType.image, "https://picsum.photos/seed/acme-ramadan/1200/800", "Moody top-down shot of handmade leather wallet on dark walnut table, warm golden lighting, Ramadan-themed"),
        ("Workshop behind-the-scenes", AssetType.image, "https://picsum.photos/seed/acme-workshop/1200/800", "Artisan hands stitching leather, natural daylight, Cairo workshop aesthetic"),
        ("Eid gift box mockup", AssetType.mockup, "https://picsum.photos/seed/acme-eidbox/1200/1200", "Walnut wooden gift box with embossed leather wallet and keychain, studio lighting"),
        ("Fall-Winter mood banner", AssetType.banner, "https://picsum.photos/seed/acme-fw26/1600/600", "Camel cognac burgundy leather swatches fanned out, editorial moodboard"),
        ("Acme monogram logo variant", AssetType.logo, "https://picsum.photos/seed/acme-logo/800/800", "Minimal embossed monogram stamp on caramel leather"),
        ("Corporate gifting lifestyle", AssetType.image, "https://picsum.photos/seed/acme-b2b/1200/800", "Executive desk with branded leather portfolio, pen, and business card holder"),
    ]
    for name, atype, url, prompt in assets:
        db.add(CreativeAsset(
            tenant_id=tenant_id,
            name=name,
            asset_type=atype,
            file_url=url,
            thumbnail_url=url,
            prompt_used=prompt,
            metadata_={"demo": True, "style": "editorial"},
        ))
    await db.flush()


async def seed_demo_leads(db: AsyncSession, tenant_id: uuid.UUID) -> None:
    existing = await db.execute(select(Lead).where(Lead.tenant_id == tenant_id).limit(1))
    if existing.scalar_one_or_none():
        return

    leads = [
        ("Layla Hassan", "layla.h@example.com", "+20 100 111 2233", "Freelance", LeadSource.instagram, LeadStatus.new, 55),
        ("Omar Abdelrahman", "omar.a@example.com", "+20 122 999 1010", "Abdelrahman Co", LeadSource.whatsapp, LeadStatus.contacted, 70),
        ("Sara Mostafa", "sara.m@example.com", "+971 50 111 2233", None, LeadSource.instagram, LeadStatus.qualified, 80),
        ("Ahmed El-Sayed", "ahmed@example.com", "+966 55 333 4455", "Saudi Premium Gifts", LeadSource.website, LeadStatus.proposal, 85),
        ("Nadia Khaled", "nadia.k@example.com", "+20 111 222 3344", None, LeadSource.ads, LeadStatus.won, 92),
        ("John Miller", "john.m@example.com", "+1 415 555 0199", "Global B2B Imports", LeadSource.website, LeadStatus.qualified, 75),
        ("Fatima Al-Qahtani", "fatima@example.com", "+966 56 123 4567", "Riyadh Retail", LeadSource.whatsapp, LeadStatus.proposal, 88),
        ("Karim Salah", None, "+20 115 555 6677", None, LeadSource.instagram, LeadStatus.new, 40),
        ("Mona Ibrahim", "mona.i@example.com", None, None, LeadSource.website, LeadStatus.contacted, 60),
        ("Ali Al-Mansoori", "ali.m@example.com", "+971 55 444 5566", "Dubai Concepts", LeadSource.messenger, LeadStatus.won, 95),
        ("Hassan Rezk", None, "+20 100 888 9900", None, LeadSource.ads, LeadStatus.lost, 20),
        ("Yasmin Farouk", "yasmin.f@example.com", "+20 122 000 1122", None, LeadSource.instagram, LeadStatus.new, 50),
    ]
    for name, email, phone, company, source, status, score in leads:
        db.add(Lead(
            tenant_id=tenant_id,
            name=name,
            email=email,
            phone=phone,
            company=company,
            source=source,
            status=status,
            score=score,
            metadata_={"demo": True},
        ))
    await db.flush()


async def seed_demo_analytics(db: AsyncSession, tenant_id: uuid.UUID) -> None:
    existing = await db.execute(
        select(SocialAccount).where(SocialAccount.tenant_id == tenant_id).limit(1)
    )
    if existing.scalar_one_or_none():
        return

    account = SocialAccount(
        tenant_id=tenant_id,
        platform=SocialPlatform.instagram,
        account_id="acme_leather_demo",
        name="@acme_leather",
        access_token_encrypted=None,
        is_active=True,
    )
    db.add(account)
    await db.flush()

    now = datetime.now(timezone.utc)
    post = SocialPost(
        tenant_id=tenant_id,
        social_account_id=account.id,
        content="Demo post aggregating tenant metrics",
        media_urls=[],
        status=SocialPostStatus.published,
        published_at=now - timedelta(days=30),
    )
    db.add(post)
    await db.flush()

    base_reach = 8000
    base_likes = 320
    for i in range(30):
        # growth curve: reach trending up, engagement stable-ish
        day_offset = 29 - i
        reach = int(base_reach * (1 + i * 0.035) + (i % 3) * 150)
        impressions = int(reach * 1.4)
        likes = int(base_likes * (1 + i * 0.015) + (i % 4) * 10)
        comments = int(likes * 0.07)
        shares = int(likes * 0.03)
        engagement_rate = round((likes + comments + shares) / max(reach, 1) * 100, 2)
        db.add(SocialMetric(
            social_post_id=post.id,
            likes=likes,
            comments=comments,
            shares=shares,
            impressions=impressions,
            reach=reach,
            engagement_rate=engagement_rate,
            recorded_at=now - timedelta(days=day_offset),
        ))
    await db.flush()


async def seed_demo_conversations(db: AsyncSession, tenant_id: uuid.UUID) -> None:
    # Need a Channel for sessions
    existing_sess = await db.execute(select(Session).where(Session.tenant_id == tenant_id).limit(1))
    if existing_sess.scalar_one_or_none():
        return

    existing_ch = await db.execute(select(Channel).where(Channel.tenant_id == tenant_id).limit(1))
    channel = existing_ch.scalar_one_or_none()
    if channel is None:
        channel = Channel(
            tenant_id=tenant_id,
            type=ChannelType.whatsapp,
            name="Demo WhatsApp",
            status=ChannelStatus.active,
            config={"demo": True},
        )
        db.add(channel)
        await db.flush()

    now = datetime.now(timezone.utc)
    conversations = [
        (
            "Layla Hassan", "+20 100 111 2233",
            [
                (MessageRole.user, "السلام عليكم، هل المحفظة الجلدية متوفرة بلون بني؟"),
                (MessageRole.assistant, "وعليكم السلام ورحمة الله! نعم، المحفظة متوفرة باللون البني الكراميل والأسود. هل تحب أشارك معك الصور والسعر؟"),
                (MessageRole.user, "أيوه من فضلك، وكمان إيه مدة التوصيل للقاهرة؟"),
                (MessageRole.assistant, "تمام. السعر 1450 جنيه، والتوصيل داخل القاهرة 1-2 أيام عمل مجاناً. هبعت لك الصور الآن."),
            ],
        ),
        (
            "Omar Abdelrahman", "+20 122 999 1010",
            [
                (MessageRole.user, "محتاج 25 قطعة هدايا للشركة، في خصم كميات؟"),
                (MessageRole.assistant, "بالتأكيد! لطلبات 25+ قطعة، نقدم خصم 15% وإمكانية تطريز شعار الشركة مجاناً. تحب تتواصل مع فريق B2B مباشرة؟"),
                (MessageRole.user, "نعم من فضلك."),
                (MessageRole.assistant, "تم تسجيل طلبك. هيتواصل معاك ممثل B2B خلال 24 ساعة."),
            ],
        ),
        (
            "Sara Mostafa", "+971 50 111 2233",
            [
                (MessageRole.user, "Hi! Do you ship to Dubai?"),
                (MessageRole.assistant, "Yes, we ship across the GCC. Delivery to Dubai takes 4-6 business days and costs 120 AED (free over 1500 AED)."),
                (MessageRole.user, "Perfect. What's your return policy?"),
                (MessageRole.assistant, "30-day free returns on unused items. We cover the return shipping."),
                (MessageRole.user, "Awesome, I'll place an order today."),
            ],
        ),
        (
            "Ahmed El-Sayed", "+966 55 333 4455",
            [
                (MessageRole.user, "هل يمكن الطباعة على المحفظة؟"),
                (MessageRole.assistant, "نعم، نقدم خدمة الحفر بالحرارة (hot-stamp) للأحرف الأولى مجاناً مع أي طلب. التطريز الكامل للشعار متاح للطلبات التجارية فقط."),
                (MessageRole.user, "ممتاز، وكم سعر الحقيبة المتوسطة؟"),
                (MessageRole.assistant, "الحقيبة المتوسطة سعرها 3200 ريال سعودي شاملة الشحن إلى المملكة."),
            ],
        ),
        (
            "Nadia Khaled", "+20 111 222 3344",
            [
                (MessageRole.user, "متى هتنزل مجموعة رمضان الجديدة؟"),
                (MessageRole.assistant, "بنطلقها الأسبوع الجاي! تحبي تنضمي لقائمة الوصول المبكر عشان تشوفي قبل الكل؟"),
                (MessageRole.user, "أكيد!"),
                (MessageRole.assistant, "تم تسجيلك. هتوصلك رسالة بروابط خاصة قبل الإطلاق الرسمي بـ 48 ساعة."),
            ],
        ),
    ]

    for i, (name, phone, msgs) in enumerate(conversations):
        session = Session(
            tenant_id=tenant_id,
            channel_id=channel.id,
            external_id=f"demo-{i+1}",
            customer_name=name,
            customer_phone=phone,
            metadata_={"demo": True},
            created_at=now - timedelta(days=i, hours=2),
            updated_at=now - timedelta(days=i),
        )
        db.add(session)
        await db.flush()
        for j, (role, content) in enumerate(msgs):
            db.add(Message(
                session_id=session.id,
                tenant_id=tenant_id,
                role=role,
                content=content,
                metadata_={},
                created_at=now - timedelta(days=i, hours=2) + timedelta(minutes=j * 3),
            ))
    await db.flush()


async def run_seed(db: AsyncSession) -> None:
    plan_ids = await seed_plans(db)
    enterprise_plan = plan_ids.get("enterprise", list(plan_ids.values())[0])
    pro_plan = plan_ids.get("professional", enterprise_plan)
    await seed_superadmin(db, enterprise_plan)
    await seed_test_customer(db, pro_plan)
    await seed_ai_providers(db)
    await seed_skills(db)

    demo = await _get_demo_tenant_user(db)
    if demo:
        tenant_id, user_id = demo
        await seed_demo_plan(db, tenant_id, user_id)
        await seed_demo_content(db, tenant_id, user_id)
        await seed_demo_creatives(db, tenant_id, user_id)
        await seed_demo_leads(db, tenant_id)
        await seed_demo_analytics(db, tenant_id)
        await seed_demo_conversations(db, tenant_id)

    await db.commit()
