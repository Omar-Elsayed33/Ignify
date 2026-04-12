import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.db.models import Competitor, CompetitorSnapshot
from app.dependencies import CurrentUser, DbSession
from app.modules.competitors.schemas import (
    CompetitorCreate,
    CompetitorResponse,
    CompetitorSnapshotResponse,
    CompetitorUpdate,
)

router = APIRouter(prefix="/competitors", tags=["competitors"])


@router.get("/", response_model=list[CompetitorResponse])
async def list_competitors(user: CurrentUser, db: DbSession, skip: int = 0, limit: int = 50):
    result = await db.execute(
        select(Competitor)
        .where(Competitor.tenant_id == user.tenant_id)
        .order_by(Competitor.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/", response_model=CompetitorResponse, status_code=status.HTTP_201_CREATED)
async def create_competitor(data: CompetitorCreate, user: CurrentUser, db: DbSession):
    competitor = Competitor(
        tenant_id=user.tenant_id,
        name=data.name,
        website=data.website,
        description=data.description,
        instagram_url=data.instagram_url,
        facebook_url=data.facebook_url,
        twitter_url=data.twitter_url,
        linkedin_url=data.linkedin_url,
        tiktok_url=data.tiktok_url,
        youtube_url=data.youtube_url,
    )
    db.add(competitor)
    await db.flush()
    return competitor


@router.get("/{competitor_id}", response_model=CompetitorResponse)
async def get_competitor(competitor_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Competitor).where(Competitor.id == competitor_id, Competitor.tenant_id == user.tenant_id)
    )
    competitor = result.scalar_one_or_none()
    if not competitor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competitor not found")
    return competitor


@router.put("/{competitor_id}", response_model=CompetitorResponse)
async def update_competitor(competitor_id: uuid.UUID, data: CompetitorUpdate, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Competitor).where(Competitor.id == competitor_id, Competitor.tenant_id == user.tenant_id)
    )
    competitor = result.scalar_one_or_none()
    if not competitor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competitor not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(competitor, field, value)
    await db.flush()
    return competitor


@router.delete("/{competitor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_competitor(competitor_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Competitor).where(Competitor.id == competitor_id, Competitor.tenant_id == user.tenant_id)
    )
    competitor = result.scalar_one_or_none()
    if not competitor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competitor not found")
    await db.delete(competitor)
    await db.flush()


# ── Snapshots / Analysis ──


@router.post("/{competitor_id}/snapshot", response_model=CompetitorSnapshotResponse, status_code=status.HTTP_201_CREATED)
async def take_snapshot(competitor_id: uuid.UUID, user: CurrentUser, db: DbSession):
    """Scrape all configured public URLs for this competitor and store a snapshot."""
    from app.core.competitor_scraper import scrape_public_page

    comp_result = await db.execute(
        select(Competitor).where(Competitor.id == competitor_id, Competitor.tenant_id == user.tenant_id)
    )
    competitor = comp_result.scalar_one_or_none()
    if not competitor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competitor not found")

    urls = [
        u for u in [
            competitor.website,
            competitor.instagram_url,
            competitor.facebook_url,
            competitor.twitter_url,
            competitor.linkedin_url,
            competitor.tiktok_url,
            competitor.youtube_url,
        ] if u
    ]

    scraped = []
    for u in urls[:10]:
        scraped.append(await scrape_public_page(u))

    snapshot = CompetitorSnapshot(
        competitor_id=competitor.id,
        data={"scraped": scraped, "url_count": len(scraped)},
        snapshot_type="public_scrape",
    )
    db.add(snapshot)
    await db.flush()
    return snapshot


@router.get("/{competitor_id}/history", response_model=list[CompetitorSnapshotResponse])
async def get_history(competitor_id: uuid.UUID, user: CurrentUser, db: DbSession):
    """Alias of /snapshots for historical API clarity."""
    comp_result = await db.execute(
        select(Competitor).where(Competitor.id == competitor_id, Competitor.tenant_id == user.tenant_id)
    )
    if not comp_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competitor not found")
    result = await db.execute(
        select(CompetitorSnapshot)
        .where(CompetitorSnapshot.competitor_id == competitor_id)
        .order_by(CompetitorSnapshot.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{competitor_id}/snapshots", response_model=list[CompetitorSnapshotResponse])
async def list_snapshots(competitor_id: uuid.UUID, user: CurrentUser, db: DbSession):
    comp_result = await db.execute(
        select(Competitor).where(Competitor.id == competitor_id, Competitor.tenant_id == user.tenant_id)
    )
    if not comp_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competitor not found")
    result = await db.execute(
        select(CompetitorSnapshot)
        .where(CompetitorSnapshot.competitor_id == competitor_id)
        .order_by(CompetitorSnapshot.created_at.desc())
    )
    return result.scalars().all()


@router.post("/{competitor_id}/analyze/agent", response_model=CompetitorSnapshotResponse, status_code=status.HTTP_201_CREATED)
async def analyze_competitor_agent(competitor_id: uuid.UUID, user: CurrentUser, db: DbSession):
    """Run the CompetitorAgent: scrape public pages → analyse content → find gaps."""
    from app.agents.registry import get_agent
    from app.db.models import Tenant

    comp_result = await db.execute(
        select(Competitor).where(Competitor.id == competitor_id, Competitor.tenant_id == user.tenant_id)
    )
    competitor = comp_result.scalar_one_or_none()
    if not competitor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competitor not found")

    urls = [
        u for u in [
            competitor.website,
            competitor.instagram_url,
            competitor.facebook_url,
            competitor.twitter_url,
            competitor.linkedin_url,
            competitor.tiktok_url,
            competitor.youtube_url,
        ] if u
    ]

    # Tenant brand context for the gap finder
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    tenant = tenant_result.scalar_one_or_none()
    our_brand = (tenant.config or {}) if tenant else {}

    try:
        agent = get_agent("competitor", tenant_id=str(user.tenant_id))
        out = await agent.run(
            {
                "tenant_id": str(user.tenant_id),
                "competitor_id": str(competitor_id),
                "name": competitor.name,
                "urls": urls,
                "our_brand": our_brand,
                "language": (our_brand.get("language") if isinstance(our_brand, dict) else None) or "ar",
            },
            thread_id=f"competitor-{competitor_id}",
        )
    except Exception as e:  # noqa: BLE001
        out = {"error": str(e)}

    snapshot_data = {
        "scraped": out.get("scraped") or [],
        "analysis": out.get("analysis") or {},
        "gaps": out.get("gaps") or [],
        "status": "completed" if not out.get("error") else "failed",
    }
    if out.get("error"):
        snapshot_data["error"] = out["error"]

    snapshot = CompetitorSnapshot(
        competitor_id=competitor_id,
        data=snapshot_data,
        snapshot_type="agent_analysis",
    )
    db.add(snapshot)
    await db.flush()
    return snapshot


@router.post("/{competitor_id}/analyze", response_model=CompetitorSnapshotResponse, status_code=status.HTTP_201_CREATED)
async def analyze_competitor(competitor_id: uuid.UUID, user: CurrentUser, db: DbSession):
    comp_result = await db.execute(
        select(Competitor).where(Competitor.id == competitor_id, Competitor.tenant_id == user.tenant_id)
    )
    competitor = comp_result.scalar_one_or_none()
    if not competitor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competitor not found")

    # Get tenant AI config
    from app.modules.assistant.service import get_tenant_ai_config
    from app.core.config import settings
    import httpx

    ai_config = await get_tenant_ai_config(db, user.tenant_id)
    provider = ai_config.get("provider") or ""
    api_key = ai_config.get("api_key") or ""
    model = ai_config.get("model") or ""

    # Fallback to platform defaults
    if not provider or not api_key:
        if settings.OPENAI_API_KEY:
            provider, api_key, model = "openai", settings.OPENAI_API_KEY, model or "gpt-4o"
        elif settings.ANTHROPIC_API_KEY:
            provider, api_key, model = "anthropic", settings.ANTHROPIC_API_KEY, model or "claude-sonnet-4-20250514"

    analysis_data = {}

    if provider and api_key:
        # Build analysis prompt
        social_info = []
        if competitor.instagram_url: social_info.append(f"Instagram: {competitor.instagram_url}")
        if competitor.facebook_url: social_info.append(f"Facebook: {competitor.facebook_url}")
        if competitor.twitter_url: social_info.append(f"Twitter/X: {competitor.twitter_url}")
        if competitor.linkedin_url: social_info.append(f"LinkedIn: {competitor.linkedin_url}")
        if competitor.tiktok_url: social_info.append(f"TikTok: {competitor.tiktok_url}")
        if competitor.youtube_url: social_info.append(f"YouTube: {competitor.youtube_url}")

        prompt = (
            f"Analyze this competitor for marketing intelligence:\n\n"
            f"Name: {competitor.name}\n"
            f"Website: {competitor.website or 'N/A'}\n"
            f"Description: {competitor.description or 'N/A'}\n"
            f"Social Profiles:\n" + ("\n".join(social_info) if social_info else "None provided") + "\n\n"
            f"Provide a detailed competitive analysis including:\n"
            f"1. **Strengths** - What they do well\n"
            f"2. **Weaknesses** - Where they fall short\n"
            f"3. **Opportunities** - How to compete against them\n"
            f"4. **Threats** - What risks they pose\n"
            f"5. **Social Media Strategy** - Analysis of their social presence\n"
            f"6. **Content Strategy** - What content approaches they use\n"
            f"7. **Recommendations** - Specific actions to take\n\n"
            f"Be specific and actionable."
        )

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{settings.AGNO_RUNTIME_URL}/execute",
                    json={
                        "provider": provider,
                        "api_key": api_key,
                        "model": model or "gpt-4o",
                        "system_prompt": "You are a competitive intelligence analyst. Provide detailed, actionable competitor analysis.",
                        "messages": [{"role": "user", "content": prompt}],
                        "tools": [],
                        "temperature": 0.7,
                        "max_tokens": 4096,
                    },
                )
                if resp.status_code == 200:
                    ai_response = resp.json()
                    analysis_data = {
                        "analysis": ai_response.get("response", ""),
                        "model_used": model,
                        "provider": provider,
                        "status": "completed",
                    }
                else:
                    analysis_data = {
                        "analysis": f"AI analysis failed: {resp.text[:200]}",
                        "status": "failed",
                        "error": resp.text[:200],
                    }
        except Exception as e:
            analysis_data = {
                "analysis": f"Analysis error: {str(e)}",
                "status": "error",
            }
    else:
        analysis_data = {
            "analysis": "No AI provider configured. Go to Settings > AI Configuration to set up an AI provider.",
            "status": "no_ai_configured",
        }

    analysis_data["website"] = competitor.website
    analysis_data["name"] = competitor.name

    snapshot = CompetitorSnapshot(
        competitor_id=competitor_id,
        data=analysis_data,
        snapshot_type="ai_analysis",
    )
    db.add(snapshot)
    await db.flush()
    return snapshot
