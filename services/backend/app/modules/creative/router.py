import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.db.models import CreativeAsset
from app.dependencies import CurrentUser, DbSession
from app.modules.creative.schemas import (
    CreativeAssetCreate,
    CreativeAssetResponse,
    CreativeAssetUpdate,
    ImageGenerateRequest,
)
from app.modules.creative.service import generate_image

router = APIRouter(prefix="/creative", tags=["creative"])


@router.get("/assets", response_model=list[CreativeAssetResponse])
async def list_assets(user: CurrentUser, db: DbSession, skip: int = 0, limit: int = 50):
    result = await db.execute(
        select(CreativeAsset)
        .where(CreativeAsset.tenant_id == user.tenant_id)
        .order_by(CreativeAsset.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/assets", response_model=CreativeAssetResponse, status_code=status.HTTP_201_CREATED)
async def create_asset(data: CreativeAssetCreate, user: CurrentUser, db: DbSession):
    asset = CreativeAsset(
        tenant_id=user.tenant_id,
        name=data.name,
        asset_type=data.asset_type,
        file_url=data.file_url,
        thumbnail_url=data.thumbnail_url,
        prompt_used=data.prompt_used,
        metadata_=data.metadata or {},
    )
    db.add(asset)
    await db.flush()
    return asset


@router.get("/assets/{asset_id}", response_model=CreativeAssetResponse)
async def get_asset(asset_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(CreativeAsset).where(CreativeAsset.id == asset_id, CreativeAsset.tenant_id == user.tenant_id)
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    return asset


@router.put("/assets/{asset_id}", response_model=CreativeAssetResponse)
async def update_asset(asset_id: uuid.UUID, data: CreativeAssetUpdate, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(CreativeAsset).where(CreativeAsset.id == asset_id, CreativeAsset.tenant_id == user.tenant_id)
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "metadata":
            setattr(asset, "metadata_", value)
        else:
            setattr(asset, field, value)
    await db.flush()
    return asset


@router.delete("/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(asset_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(CreativeAsset).where(CreativeAsset.id == asset_id, CreativeAsset.tenant_id == user.tenant_id)
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    await db.delete(asset)
    await db.flush()


@router.post("/generate-image", response_model=CreativeAssetResponse, status_code=status.HTTP_201_CREATED)
async def generate_image_endpoint(data: ImageGenerateRequest, user: CurrentUser, db: DbSession):
    asset = await generate_image(
        db=db,
        tenant_id=user.tenant_id,
        prompt=data.prompt,
        asset_type=data.asset_type.value,
        name=data.name,
        width=data.width,
        height=data.height,
        style=data.style,
    )
    return asset
