"""AI-assisted onboarding & settings endpoints."""
from __future__ import annotations

from fastapi import APIRouter

from app.core.rate_limit_presets import MEDIUM
from app.dependencies import CurrentUser
from app.modules.ai_assistant import service
from app.modules.ai_assistant.schemas import (
    AnalyzeLogoRequest,
    AnalyzeWebsiteRequest,
    DiscoverCompetitorsRequest,
    DraftBusinessProfileRequest,
)

router = APIRouter(prefix="/ai-assistant", tags=["ai-assistant"])


@router.post("/analyze-website", dependencies=[MEDIUM])
async def analyze_website(data: AnalyzeWebsiteRequest, user: CurrentUser):
    return await service.analyze_website(data.url, data.lang)


@router.post("/analyze-logo", dependencies=[MEDIUM])
async def analyze_logo(data: AnalyzeLogoRequest, user: CurrentUser):
    return await service.extract_brand_from_logo(data.logo_url)


@router.post("/discover-competitors", dependencies=[MEDIUM])
async def discover_competitors(data: DiscoverCompetitorsRequest, user: CurrentUser):
    comps = await service.discover_competitors(
        data.business_name,
        data.industry,
        data.country,
        data.lang,
        description=data.description,
        products=data.products,
        website=data.website,
    )
    return {"competitors": comps}


@router.post("/draft-business-profile", dependencies=[MEDIUM])
async def draft_business_profile(data: DraftBusinessProfileRequest, user: CurrentUser):
    return await service.generate_business_profile_draft(
        data.website_url, data.lang, country=data.country
    )
