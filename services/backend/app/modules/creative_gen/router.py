from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select

from app.core.gating import enforce_quota
from app.core.rate_limit import rate_limit_dep
from app.db.models import CreativeAsset
from app.dependencies import CurrentUser, DbSession
from app.modules.creative_gen.schemas import (
    CreativeAssetResponse,
    CreativeGenerateRequest,
    CreativeGenerateResponse,
)
from app.modules.creative_gen.service import generate_creative
from app.modules.plans.context import fetch_plan_context

router = APIRouter(prefix="/creative-gen", tags=["creative-gen"])


@router.post(
    "/generate",
    response_model=CreativeGenerateResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[
        Depends(enforce_quota("images")),
        rate_limit_dep(limit=30, window_seconds=3600, scope="user"),
    ],
)
async def generate(data: CreativeGenerateRequest, user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenant")
    plan_ctx = await fetch_plan_context(db, user.tenant_id, data.plan_id, data.language)
    effective_idea = f"{plan_ctx}\n\nCreative brief: {data.idea}" if plan_ctx else data.idea
    try:
        result = await generate_creative(
            db,
            tenant_id=user.tenant_id,
            user_id=user.id,
            idea=effective_idea,
            style=data.style,
            dimensions=data.dimensions,
            language=data.language,
            brand_voice=data.brand_voice,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Creative generation failed: {e}")
    return result


@router.get("/assets", response_model=list[CreativeAssetResponse])
async def list_assets(
    user: CurrentUser,
    db: DbSession,
    asset_type: str | None = Query(None, description="Filter by asset type"),
    search: str | None = Query(None),
    since: datetime | None = Query(None),
    until: datetime | None = Query(None),
    skip: int = 0,
    limit: int = 100,
):
    if not user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenant")
    stmt = select(CreativeAsset).where(CreativeAsset.tenant_id == user.tenant_id)
    if asset_type and asset_type != "all":
        stmt = stmt.where(CreativeAsset.asset_type == asset_type)
    if search:
        like = f"%{search}%"
        stmt = stmt.where(CreativeAsset.name.ilike(like))
    if since:
        stmt = stmt.where(CreativeAsset.created_at >= since)
    if until:
        stmt = stmt.where(CreativeAsset.created_at <= until)
    stmt = stmt.order_by(CreativeAsset.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.delete("/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(asset_id: uuid.UUID, user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenant")
    result = await db.execute(
        select(CreativeAsset).where(
            CreativeAsset.id == asset_id,
            CreativeAsset.tenant_id == user.tenant_id,
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    await db.delete(asset)
    await db.commit()
