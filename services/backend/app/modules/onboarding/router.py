from fastapi import APIRouter, HTTPException, status

from app.core.rate_limit_presets import MEDIUM
from app.dependencies import CurrentUser, DbSession
from app.modules.onboarding import service
from app.modules.onboarding.schemas import (
    BrandVoiceStep,
    BusinessProfileStep,
    ChannelsStep,
    OnboardingStatus,
)

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


def _require_tenant(user) -> None:
    if not user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User has no tenant")


@router.get("/status", response_model=OnboardingStatus)
async def get_status(user: CurrentUser, db: DbSession):
    _require_tenant(user)
    return await service.get_onboarding_status(db, user.tenant_id)


@router.post("/business-profile", response_model=OnboardingStatus, dependencies=[MEDIUM])
async def post_business_profile(data: BusinessProfileStep, user: CurrentUser, db: DbSession):
    _require_tenant(user)
    return await service.save_business_profile(db, user.tenant_id, data.model_dump())


@router.post("/brand-voice", response_model=OnboardingStatus, dependencies=[MEDIUM])
async def post_brand_voice(data: BrandVoiceStep, user: CurrentUser, db: DbSession):
    _require_tenant(user)
    return await service.save_brand_voice(db, user.tenant_id, data.model_dump())


@router.post("/channels", response_model=OnboardingStatus, dependencies=[MEDIUM])
async def post_channels(data: ChannelsStep, user: CurrentUser, db: DbSession):
    _require_tenant(user)
    return await service.save_channels(db, user.tenant_id, data.channels)


@router.post("/complete", response_model=OnboardingStatus, dependencies=[MEDIUM])
async def post_complete(user: CurrentUser, db: DbSession):
    _require_tenant(user)
    return await service.mark_complete(db, user.tenant_id)
