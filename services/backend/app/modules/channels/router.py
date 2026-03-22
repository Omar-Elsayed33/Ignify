import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import Channel, UserRole
from app.dependencies import CurrentUser, DbSession
from app.modules.channels.schemas import ChannelCreate, ChannelResponse, ChannelUpdate

router = APIRouter(prefix="/channels", tags=["channels"])


@router.get("/", response_model=list[ChannelResponse])
async def list_channels(user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Channel).where(Channel.tenant_id == user.tenant_id).order_by(Channel.created_at.desc())
    )
    return result.scalars().all()


@router.post("/", response_model=ChannelResponse, status_code=status.HTTP_201_CREATED)
async def create_channel(data: ChannelCreate, user: CurrentUser, db: DbSession):
    if user.role not in (UserRole.owner, UserRole.admin, UserRole.superadmin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted")
    channel = Channel(
        tenant_id=user.tenant_id,
        type=data.type,
        name=data.name,
        config=data.config or {},
    )
    db.add(channel)
    await db.flush()
    return channel


@router.get("/{channel_id}", response_model=ChannelResponse)
async def get_channel(channel_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Channel).where(Channel.id == channel_id, Channel.tenant_id == user.tenant_id)
    )
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")
    return channel


@router.put("/{channel_id}", response_model=ChannelResponse)
async def update_channel(channel_id: uuid.UUID, data: ChannelUpdate, user: CurrentUser, db: DbSession):
    if user.role not in (UserRole.owner, UserRole.admin, UserRole.superadmin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted")
    result = await db.execute(
        select(Channel).where(Channel.id == channel_id, Channel.tenant_id == user.tenant_id)
    )
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")
    if data.name is not None:
        channel.name = data.name
    if data.config is not None:
        channel.config = data.config
    if data.status is not None:
        channel.status = data.status
    await db.flush()
    return channel


@router.delete("/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_channel(channel_id: uuid.UUID, user: CurrentUser, db: DbSession):
    if user.role not in (UserRole.owner, UserRole.admin, UserRole.superadmin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted")
    result = await db.execute(
        select(Channel).where(Channel.id == channel_id, Channel.tenant_id == user.tenant_id)
    )
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")
    await db.delete(channel)
    await db.flush()
