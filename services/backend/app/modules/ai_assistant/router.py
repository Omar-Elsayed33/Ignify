"""AI-assisted onboarding & settings endpoints."""
from __future__ import annotations

from sqlalchemy import select

from fastapi import APIRouter

from app.core.rate_limit_presets import MEDIUM
from app.db.models import Competitor
from app.dependencies import CurrentUser, DbSession
from app.modules.ai_assistant import service
from app.modules.ai_assistant.schemas import (
    AnalyzeLogoRequest,
    AnalyzeWebsiteRequest,
    DiscoverCompetitorsRequest,
    DraftBusinessProfileRequest,
)
from app.modules.tenant_settings.service import sync_competitors_to_profile

router = APIRouter(prefix="/ai-assistant", tags=["ai-assistant"])


async def _save_competitors(
    comps: list, tenant_id, db: DbSession
) -> int:
    """Upsert discovered competitors into the Competitor table. Returns count added."""
    if not comps or not tenant_id:
        return 0

    # Load existing competitor names for this tenant (case-insensitive dedup)
    existing_result = await db.execute(
        select(Competitor.name).where(Competitor.tenant_id == tenant_id)
    )
    existing_names = {n.lower() for n in existing_result.scalars().all()}

    added = 0
    for c in comps:
        if isinstance(c, str):
            name, url, desc = c, None, None
        elif isinstance(c, dict):
            name = c.get("name") or ""
            url = c.get("url") or None
            desc = c.get("description") or c.get("positioning") or None
        else:
            continue

        if not name or name.lower() in existing_names:
            continue

        db.add(Competitor(
            tenant_id=tenant_id,
            name=name,
            website=url,
            description=desc,
        ))
        existing_names.add(name.lower())
        added += 1

    if added:
        await db.flush()
        await sync_competitors_to_profile(db, tenant_id)

    return added


@router.post("/analyze-website", dependencies=[MEDIUM])
async def analyze_website(data: AnalyzeWebsiteRequest, user: CurrentUser):
    return await service.analyze_website(data.url, data.lang)


@router.post("/analyze-logo", dependencies=[MEDIUM])
async def analyze_logo(data: AnalyzeLogoRequest, user: CurrentUser):
    return await service.extract_brand_from_logo(data.logo_url)


@router.post("/discover-competitors", dependencies=[MEDIUM])
async def discover_competitors(data: DiscoverCompetitorsRequest, user: CurrentUser, db: DbSession):
    comps = await service.discover_competitors(
        data.business_name,
        data.industry,
        data.country,
        data.lang,
        description=data.description,
        products=data.products,
        website=data.website,
    )
    added = await _save_competitors(comps, user.tenant_id, db)
    return {"competitors": comps, "saved_to_list": added}


@router.post("/draft-business-profile", dependencies=[MEDIUM])
async def draft_business_profile(data: DraftBusinessProfileRequest, user: CurrentUser, db: DbSession):
    result = await service.generate_business_profile_draft(
        data.website_url, data.lang, country=data.country
    )
    added = await _save_competitors(
        result.get("probable_competitors") or [], user.tenant_id, db
    )
    result["competitors_saved"] = added
    return result
