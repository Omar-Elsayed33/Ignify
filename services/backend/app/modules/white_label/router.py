from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.dependencies import CurrentUser, DbSession
from app.modules.white_label.schemas import (
    DomainVerifyRequest,
    DomainVerifyResponse,
    WhiteLabelSettings,
    WhiteLabelUpdate,
)
from app.modules.white_label.service import (
    get_settings,
    update_settings,
    verify_domain,
)

router = APIRouter(prefix="/white-label", tags=["white-label"])


@router.get("/settings", response_model=WhiteLabelSettings)
async def read(user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=403, detail="No tenant")
    return await get_settings(db, user.tenant_id)


@router.put("/settings", response_model=WhiteLabelSettings)
async def update(data: WhiteLabelUpdate, user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=403, detail="No tenant")
    patch = data.model_dump(exclude_unset=True)
    return await update_settings(db, user.tenant_id, patch)


@router.post("/custom-domain/verify", response_model=DomainVerifyResponse)
async def verify(data: DomainVerifyRequest, user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=403, detail="No tenant")
    result = await verify_domain(db, user.tenant_id, data.domain)
    return result
