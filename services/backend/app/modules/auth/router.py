from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit_presets import MEDIUM, PUBLIC_IP
from app.db.database import get_db
from app.dependencies import CurrentUser
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
