import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import Invitation, User, UserRole
from app.dependencies import CurrentUser, DbSession
from app.modules.users.schemas import InviteRequest, UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=list[UserResponse])
async def list_users(
    user: CurrentUser,
    db: DbSession,
    skip: int = 0,
    limit: int = 50,
):
    if user.role not in (UserRole.owner, UserRole.admin, UserRole.superadmin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted")
    result = await db.execute(
        select(User)
        .where(User.tenant_id == user.tenant_id)
        .offset(skip)
        .limit(limit)
        .order_by(User.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: uuid.UUID,
    user: CurrentUser,
    db: DbSession,
):
    result = await db.execute(
        select(User).where(User.id == user_id, User.tenant_id == user.tenant_id)
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return target


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    user: CurrentUser,
    db: DbSession,
):
    if user.role not in (UserRole.owner, UserRole.admin, UserRole.superadmin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted")

    result = await db.execute(
        select(User).where(User.id == user_id, User.tenant_id == user.tenant_id)
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if data.full_name is not None:
        target.full_name = data.full_name
    if data.role is not None:
        target.role = data.role
    if data.lang_preference is not None:
        target.lang_preference = data.lang_preference
    if data.is_active is not None:
        target.is_active = data.is_active
    await db.flush()
    return target


@router.post("/invite", status_code=status.HTTP_201_CREATED)
async def invite_user(
    data: InviteRequest,
    user: CurrentUser,
    db: DbSession,
):
    if user.role not in (UserRole.owner, UserRole.admin, UserRole.superadmin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted")

    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists")

    token = uuid.uuid4().hex
    invitation = Invitation(
        tenant_id=user.tenant_id,
        email=data.email,
        role=data.role,
        token=token,
        invited_by=user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(invitation)
    await db.flush()
    return {"invitation_token": token, "email": data.email, "expires_in_days": 7}
