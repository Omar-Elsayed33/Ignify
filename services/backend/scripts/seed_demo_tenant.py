"""Seed a sales-demo tenant with approved subscription + sample content.

Idempotent: safe to re-run. If the demo tenant already exists it refreshes
fields rather than failing or creating duplicates.

What this creates
-----------------
- Tenant `demo-ignify` on Pro plan, subscription_active=True, AI budget $22
- User `demo@ignify.com` / password `Demo@2024` (owner)
- Business profile filled in Arabic + English
- Brand settings: primary color, tone
- 3 placeholder ContentPost rows (approved status, pre-written copy)
- 3 placeholder CreativeAsset rows (fake URLs — swap for real ones after
  running a real creative-gen if you want live images in the demo)
- 2 scheduled SocialPost rows (manual mode, future dates, caption + content link)
- No plan rows — the demo plan is added live in the sales meeting so the
  prospect sees the generator animate in real time. If you want a pre-
  built plan for offline demos, run `demo` through the dashboard once
  before the meeting.

Run:
    docker compose exec backend python -m scripts.seed_demo_tenant

Idempotency: re-running updates descriptions + approves subscription again,
but does NOT duplicate posts or assets (checked by tenant_id).
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.crypto import encrypt_token  # noqa: F401 — imported so Fernet init runs
from app.db.database import async_session
from app.db.models import (
    BrandSettings,
    ContentPost,
    ContentStatus,
    CreativeAsset,
    AssetType,
    Plan,
    PostType,
    SocialPlatform,
    SocialPost,
    SocialPostStatus,
    Tenant,
    User,
    UserRole,
)
from app.core.security import hash_password


DEMO_EMAIL = "demo@ignify.com"
DEMO_PASSWORD = "Demo@2024"
DEMO_SLUG = "demo-ignify"
DEMO_NAME = "Ignify Demo Workspace"


async def _ensure_pro_plan(db) -> Plan:
    """Find a Pro-equivalent plan row.

    Dev DBs may have either the Phase 6 catalog slugs (`pro`) or the older
    pre-restructure slugs (`professional` / `enterprise`). Prefer `pro` if
    present, fall back to `professional`, then to any plan containing "pro"
    in the slug/name. Never returns None — raises with a clear message so
    the seed script can be re-run after `app.db.seed` is executed.
    """
    for slug_try in ("pro", "professional", "enterprise"):
        result = await db.execute(select(Plan).where(Plan.slug == slug_try))
        plan = result.scalar_one_or_none()
        if plan is not None:
            return plan
    # Last resort: any active plan. This keeps the demo workable even on
    # minimally-seeded DBs; the demo tenant's budget still syncs from
    # DEFAULT_PLANS via the slug lookup when subscription activates.
    result = await db.execute(select(Plan).where(Plan.is_active == True).limit(1))  # noqa: E712
    plan = result.scalar_one_or_none()
    if plan is not None:
        return plan
    raise RuntimeError(
        "No plans in DB. Run `docker compose exec backend python -m app.db.seed` first."
    )


async def _ensure_tenant(db, pro_plan: Plan) -> Tenant:
    result = await db.execute(select(Tenant).where(Tenant.slug == DEMO_SLUG))
    tenant = result.scalar_one_or_none()
    if tenant:
        tenant.plan_id = pro_plan.id
        tenant.subscription_active = True
        tenant.is_active = True
        tenant.config = {
            "business_profile": {
                "industry": "ecommerce",
                "country": "SA",
                "primary_language": "ar",
                "business_name": "متجر الأمل",
                "description": (
                    "متجر إلكتروني متخصص في بيع منتجات العناية بالبشرة الطبيعية "
                    "للنساء السعوديات، من علامة تجارية محلية بأسعار منافسة."
                ),
                "target_audience": "نساء ٢٥–٤٥، دخل متوسط-عالي، مهتمات بمكونات طبيعية.",
                "products": ["كريم نهار", "سيروم فيتامين سي", "ماسك طين"],
                "competitors": ["The Body Shop", "Farmasi", "Lush"],
                "website": "https://demo.ignify.ai",
                "phone": "+966500000000",
                "business_email": "hello@demo.ignify.ai",
            },
            "onboarding": {"business_profile_done": True, "brand_done": True, "channels_done": True},
            "workflow": {"approval_required": True},
        }
        return tenant
    tenant = Tenant(
        name=DEMO_NAME,
        slug=DEMO_SLUG,
        plan_id=pro_plan.id,
        is_active=True,
        subscription_active=True,
        config={
            "business_profile": {
                "industry": "ecommerce",
                "country": "SA",
                "primary_language": "ar",
                "business_name": "متجر الأمل",
                "description": (
                    "متجر إلكتروني متخصص في بيع منتجات العناية بالبشرة الطبيعية "
                    "للنساء السعوديات."
                ),
                "target_audience": "نساء ٢٥–٤٥، دخل متوسط-عالي.",
                "products": ["كريم نهار", "سيروم فيتامين سي", "ماسك طين"],
                "competitors": ["The Body Shop", "Farmasi", "Lush"],
                "website": "https://demo.ignify.ai",
                "phone": "+966500000000",
                "business_email": "hello@demo.ignify.ai",
            },
            "onboarding": {
                "business_profile_done": True,
                "brand_done": True,
                "channels_done": True,
            },
            "workflow": {"approval_required": True},
        },
    )
    db.add(tenant)
    await db.flush()
    return tenant


async def _ensure_owner(db, tenant: Tenant) -> User:
    result = await db.execute(select(User).where(User.email == DEMO_EMAIL))
    user = result.scalar_one_or_none()
    if user:
        user.tenant_id = tenant.id
        user.is_active = True
        user.email_verified = True
        user.email_verified_at = datetime.now(timezone.utc)
        return user
    user = User(
        tenant_id=tenant.id,
        email=DEMO_EMAIL,
        password_hash=hash_password(DEMO_PASSWORD),
        full_name="Demo Owner",
        role=UserRole.owner,
        lang_preference="ar",
        is_active=True,
        email_verified=True,
        email_verified_at=datetime.now(timezone.utc),
    )
    db.add(user)
    return user


async def _ensure_brand(db, tenant: Tenant) -> BrandSettings:
    result = await db.execute(
        select(BrandSettings).where(BrandSettings.tenant_id == tenant.id)
    )
    brand = result.scalar_one_or_none()
    fields = {
        "brand_name": "متجر الأمل",
        "brand_voice": "ودودة، دافئة، وثوقة. نتحدث بالعامية السعودية.",
        "tone": "friendly",
        "colors": {"primary": "#E91E63", "secondary": "#FCE4EC", "accent": "#C2185B"},
        "fonts": {},
    }
    if brand:
        for k, v in fields.items():
            setattr(brand, k, v)
        return brand
    brand = BrandSettings(tenant_id=tenant.id, **fields)
    db.add(brand)
    return brand


async def _seed_content_posts(db, tenant: Tenant) -> list[ContentPost]:
    """Idempotent: only creates if the tenant has < 3 demo posts already."""
    result = await db.execute(
        select(ContentPost).where(ContentPost.tenant_id == tenant.id)
    )
    existing = result.scalars().all()
    if len(existing) >= 3:
        return list(existing)[:3]

    sample_posts = [
        {
            "title": "نسبة الإطلاق الجديدة",
            "body": (
                "🌸 خبر حلو لعميلاتنا الغاليات!\n\nالسيروم الجديد بفيتامين سي "
                "٢٠٪ نازل هالأسبوع. يعالج البقع، يوحد اللون، ويعطيكِ إشراقة طبيعية.\n\n"
                "٣ أيام فقط قبل الإطلاق الرسمي — احجزي قبل الجميع.\n\n"
                "#مستحضرات_تجميل #العناية_بالبشرة #فيتامين_سي"
            ),
            "post_type": PostType.social,
            "platform": "instagram",
        },
        {
            "title": "دليل روتين الصباح",
            "body": (
                "💡 ٥ خطوات لبشرة مشرقة كل صباح\n\n"
                "١. تنظيف لطيف بمنظف خالٍ من الصابون\n"
                "٢. تونر متوازن (بدون كحول!)\n"
                "٣. سيروم فيتامين سي على البشرة الرطبة\n"
                "٤. كريم مرطب خفيف\n"
                "٥. واقي شمس ٥٠ — حتى في الداخل\n\n"
                "جربي الروتين أسبوع وشوفي الفرق 💕"
            ),
            "post_type": PostType.social,
            "platform": "facebook",
        },
        {
            "title": "طريقة استخدام ماسك الطين",
            "body": (
                "🎯 كيف تستخدمين ماسك الطين بطريقة صحيحة؟\n\n"
                "• طبقي طبقة متوسطة على بشرة نظيفة\n"
                "• اتركيه ١٠–١٥ دقيقة (مش أكثر!)\n"
                "• اشطفي بماء فاتر\n"
                "• استخدميه مرة أو مرتين بالأسبوع\n\n"
                "⚠️ لا تتركيه حتى يجف تماماً — يسحب الترطيب."
            ),
            "post_type": PostType.social,
            "platform": "instagram",
        },
    ]
    created = []
    for p in sample_posts:
        post = ContentPost(
            tenant_id=tenant.id,
            title=p["title"],
            body=p["body"],
            post_type=p["post_type"],
            platform=p["platform"],
            status=ContentStatus.approved,
            metadata_={"demo": True, "created_via": "seed_demo_tenant.py"},
        )
        db.add(post)
        created.append(post)
    await db.flush()
    return created


async def _seed_creative_assets(db, tenant: Tenant) -> None:
    result = await db.execute(
        select(CreativeAsset).where(CreativeAsset.tenant_id == tenant.id)
    )
    if len(result.scalars().all()) >= 3:
        return
    # Placeholder image URLs. Demo-day prep: run creative-gen live and
    # replace these before the call. These are safe stock photos.
    placeholders = [
        ("إطلاق السيروم", "https://picsum.photos/seed/ignify-demo-1/800/800"),
        ("روتين الصباح", "https://picsum.photos/seed/ignify-demo-2/800/800"),
        ("ماسك الطين", "https://picsum.photos/seed/ignify-demo-3/800/800"),
    ]
    for name, url in placeholders:
        asset = CreativeAsset(
            tenant_id=tenant.id,
            name=name,
            asset_type=AssetType.image,
            file_url=url,
            thumbnail_url=url,
            prompt_used="seed placeholder",
            metadata_={
                "demo": True,
                "plan_slug": "pro",
                "model": "black-forest-labs/flux-1.1-pro",
                "quality_label": "Premium",
                "cost_usd": 0.0,  # seed rows don't count against real budget
                "regen_index": 0,
            },
        )
        db.add(asset)


async def _seed_scheduled_posts(db, tenant: Tenant, content_posts: list[ContentPost]) -> None:
    """Create 2 manual-mode scheduled posts in the near future."""
    if not content_posts:
        return
    result = await db.execute(
        select(SocialPost).where(
            SocialPost.tenant_id == tenant.id,
            SocialPost.status == SocialPostStatus.scheduled,
        )
    )
    if len(result.scalars().all()) >= 2:
        return

    now = datetime.now(timezone.utc)
    scheduled = [
        SocialPost(
            tenant_id=tenant.id,
            content_post_id=content_posts[0].id,
            platform=SocialPlatform.instagram,
            content=content_posts[0].body,
            media_urls=[],
            status=SocialPostStatus.scheduled,
            publish_mode="manual",
            scheduled_at=now + timedelta(days=1, hours=10),  # tomorrow 10am
        ),
        SocialPost(
            tenant_id=tenant.id,
            content_post_id=content_posts[1].id,
            platform=SocialPlatform.facebook,
            content=content_posts[1].body,
            media_urls=[],
            status=SocialPostStatus.scheduled,
            publish_mode="manual",
            scheduled_at=now + timedelta(days=2, hours=19),  # day after, 7pm
        ),
    ]
    for sp in scheduled:
        db.add(sp)


async def main() -> None:
    async with async_session() as db:
        pro_plan = await _ensure_pro_plan(db)
        tenant = await _ensure_tenant(db, pro_plan)
        await _ensure_owner(db, tenant)
        await _ensure_brand(db, tenant)
        posts = await _seed_content_posts(db, tenant)
        await _seed_creative_assets(db, tenant)
        await _seed_scheduled_posts(db, tenant, posts)

        # Sync AI budget now that plan is set — mirrors the subscription-
        # activation flow for real tenants.
        try:
            from app.modules.ai_usage.service import sync_tenant_budget_to_plan
            await sync_tenant_budget_to_plan(db, tenant)
        except Exception as exc:  # noqa: BLE001
            print(f"  (budget sync skipped: {exc})")

        # Override: demo tenant always gets the Pro-tier cap ($22) regardless
        # of what the DB's plan row resolves to — so the demo shows a realistic
        # spending ceiling. On freshly-seeded (Phase 6) DBs with slug='pro'
        # this is a no-op; on legacy DBs (slug='professional') it corrects
        # the $0.50 fallback to the intended Pro cap.
        from app.db.models import TenantOpenRouterConfig
        cfg_q = await db.execute(
            select(TenantOpenRouterConfig).where(
                TenantOpenRouterConfig.tenant_id == tenant.id
            )
        )
        cfg = cfg_q.scalar_one_or_none()
        if cfg is not None:
            cfg.monthly_limit_usd = 22.00
            cfg.usage_usd = 0.0

        await db.commit()

    print("=" * 60)
    print("Demo tenant seeded.")
    print(f"  Slug:     {DEMO_SLUG}")
    print(f"  Email:    {DEMO_EMAIL}")
    print(f"  Password: {DEMO_PASSWORD}")
    print(f"  Plan:     Pro ($22/mo AI budget)")
    print(f"  Status:   subscription_active = true, email_verified = true")
    print("  Content:  3 approved Arabic posts")
    print("  Creatives: 3 placeholder images (swap for real pre-demo)")
    print("  Scheduled: 2 manual-mode posts (tomorrow + day after)")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
