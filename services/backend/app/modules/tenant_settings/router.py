from fastapi import APIRouter, HTTPException, status

from app.core.rate_limit_presets import MEDIUM
from app.dependencies import CurrentUser, DbSession
from app.modules.tenant_settings import service
from app.modules.tenant_settings.schemas import (
    AllSettingsResponse,
    BrandPayload,
    BrandResponse,
    BusinessProfile,
    ChannelsPayload,
    ChannelsResponse,
)

router = APIRouter(prefix="/tenant-settings", tags=["tenant-settings"])


def _require_tenant(user) -> None:
    if not user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User has no tenant"
        )


@router.get("/business-profile", response_model=BusinessProfile)
async def get_business_profile(user: CurrentUser, db: DbSession):
    _require_tenant(user)
    return await service.get_business_profile(db, user.tenant_id)


@router.put(
    "/business-profile", response_model=BusinessProfile, dependencies=[MEDIUM]
)
async def put_business_profile(
    data: BusinessProfile, user: CurrentUser, db: DbSession
):
    _require_tenant(user)
    return await service.update_business_profile(
        db, user.tenant_id, data.model_dump()
    )


@router.get("/brand", response_model=BrandResponse)
async def get_brand(user: CurrentUser, db: DbSession):
    _require_tenant(user)
    return await service.get_brand(db, user.tenant_id)


@router.put("/brand", response_model=BrandResponse, dependencies=[MEDIUM])
async def put_brand(data: BrandPayload, user: CurrentUser, db: DbSession):
    _require_tenant(user)
    return await service.update_brand(
        db, user.tenant_id, data.model_dump(exclude_unset=True)
    )


@router.get("/channels", response_model=ChannelsResponse)
async def get_channels(user: CurrentUser, db: DbSession):
    _require_tenant(user)
    channels = await service.get_channels(db, user.tenant_id)
    return {"channels": channels}


@router.put("/channels", response_model=ChannelsResponse, dependencies=[MEDIUM])
async def put_channels(data: ChannelsPayload, user: CurrentUser, db: DbSession):
    _require_tenant(user)
    channels = await service.update_channels(db, user.tenant_id, data.channels)
    return {"channels": channels}


@router.get("/all", response_model=AllSettingsResponse)
async def get_all(user: CurrentUser, db: DbSession):
    _require_tenant(user)
    return await service.get_all(db, user.tenant_id)
