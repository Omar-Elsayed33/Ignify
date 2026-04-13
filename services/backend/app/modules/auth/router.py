from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit_presets import MEDIUM, PUBLIC_IP
from app.core.security import hash_password, verify_password
from app.db.database import get_db
from app.db.models import User
from app.dependencies import CurrentUser, DbSession
from app.modules.auth.schemas import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResendVerificationResponse,
    TokenResponse,
    UserResponse,
    VerifyEmailRequest,
)
from app.modules.auth.service import (
    login_user,
    logout_user,
    refresh_tokens,
    register_user,
    request_verification_email,
    verify_email,
)


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[PUBLIC_IP],
)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    try:
        user, tokens = await register_user(db, data)
        return tokens
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/login", response_model=TokenResponse, dependencies=[PUBLIC_IP])
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    try:
        user, tokens = await login_user(db, data.email, data.password)
        return tokens
    except ValueError as e:
        msg = str(e)
        if msg == "email_not_verified":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="email_not_verified"
            )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=msg)


@router.post("/refresh", response_model=TokenResponse, dependencies=[PUBLIC_IP])
async def refresh(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        tokens = await refresh_tokens(db, data.refresh_token)
        return tokens
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    await logout_user(db, data.refresh_token)


@router.get("/me", response_model=UserResponse)
async def me(user: CurrentUser):
    return user


@router.patch("/me", response_model=UserResponse)
async def update_me(data: ProfileUpdateRequest, user: CurrentUser, db: DbSession):
    result = await db.execute(select(User).where(User.id == user.id))
    db_user = result.scalar_one()

    if data.full_name is not None:
        db_user.full_name = data.full_name.strip()

    if data.new_password:
        if not data.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="current_password required to set new password",
            )
        if not verify_password(data.current_password, db_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="current_password_wrong",
            )
        if len(data.new_password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="password_too_short",
            )
        db_user.hashed_password = hash_password(data.new_password)

    await db.flush()
    return db_user


@router.post("/verify-email", dependencies=[PUBLIC_IP])
async def verify_email_endpoint(data: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    try:
        user = await verify_email(db, data.token)
        return {"success": True, "email": user.email}
    except ValueError as e:
        reason = str(e)
        detail = "expired" if reason == "expired" else "invalid"
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


@router.post(
    "/resend-verification",
    response_model=ResendVerificationResponse,
    dependencies=[MEDIUM],
)
async def resend_verification(user: CurrentUser, db: AsyncSession = Depends(get_db)):
    if user.email_verified:
        return ResendVerificationResponse(success=True, message="already_verified")
    try:
        await request_verification_email(db, user.id)
        return ResendVerificationResponse(success=True, message="sent")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
