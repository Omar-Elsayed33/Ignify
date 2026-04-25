from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from datetime import datetime, timezone

from app.core.rate_limit_presets import MEDIUM, PUBLIC_IP
from app.core.security import hash_password, verify_password
from app.db.database import get_db
from app.db.models import (
    AuditLog,
    Competitor,
    ContentPost,
    MarketingPlan,
    SEOAudit,
    SocialPost,
    Tenant,
    User,
)
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
        if not verify_password(data.current_password, db_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="current_password_wrong",
            )
        if len(data.new_password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="password_too_short",
            )
        db_user.password_hash = hash_password(data.new_password)

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


def _serialize(obj) -> dict:
    """Lightweight serializer — includes all non-relationship columns as primitives."""
    from sqlalchemy import inspect as sa_inspect

    out: dict = {}
    for col in sa_inspect(obj.__class__).columns:
        v = getattr(obj, col.key, None)
        if hasattr(v, "isoformat"):
            out[col.key] = v.isoformat()
        elif hasattr(v, "value"):  # Enum
            out[col.key] = v.value
        elif isinstance(v, (dict, list, str, int, float, bool)) or v is None:
            out[col.key] = v
        else:
            out[col.key] = str(v)
    return out


@router.get("/me/data-export")
async def export_user_data(user: CurrentUser, db: DbSession):
    """GDPR-style data export. Returns all tenant-scoped records the user owns as JSON."""
    tenant_id = user.tenant_id

    async def _all(model):
        result = await db.execute(select(model).where(model.tenant_id == tenant_id))
        return [_serialize(row) for row in result.scalars().all()]

    tenant = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()

    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user": _serialize(user),
        "tenant": _serialize(tenant) if tenant else None,
        "marketing_plans": await _all(MarketingPlan),
        "content_posts": await _all(ContentPost),
        "social_posts": await _all(SocialPost),
        "competitors": await _all(Competitor),
        "seo_audits": await _all(SEOAudit),
    }


class AccountDeleteRequest(BaseModel):
    current_password: str
    confirm_phrase: str  # must equal "DELETE" (or Arabic "حذف") — prevents accidental deletion


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_account(data: AccountDeleteRequest, user: CurrentUser, db: DbSession):
    """Soft-delete the user account. Hard deletion runs 7 days later (cleanup job, not implemented here)."""
    if data.confirm_phrase.strip().upper() not in {"DELETE", "حذف"}:
        raise HTTPException(status_code=400, detail="confirm_phrase_mismatch")

    result = await db.execute(select(User).where(User.id == user.id))
    db_user = result.scalar_one()

    if not verify_password(data.current_password, db_user.password_hash):
        raise HTTPException(status_code=400, detail="current_password_wrong")

    # Soft-delete: disable login by marking email as deleted; preserve row for 7-day grace.
    db_user.is_active = False
    # Namespace the email so re-registration with same address is possible during grace period.
    db_user.email = f"deleted-{db_user.id}@deleted.ignify"
    await db.flush()
    return


@router.get("/me/audit-log")
async def get_audit_log(user: CurrentUser, db: DbSession, limit: int = 100):
    """Return recent audit-log entries for the current tenant. Owner/admin only."""
    if user.role not in {"owner", "admin", "superadmin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")

    limit = max(1, min(limit, 500))
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.tenant_id == user.tenant_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )
    rows = result.scalars().all()
    return [
        {
            "id": str(row.id),
            "user_id": str(row.user_id) if row.user_id else None,
            "action": row.action,
            "resource_type": row.resource_type,
            "resource_id": row.resource_id,
            "details": row.details or {},
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in rows
    ]
