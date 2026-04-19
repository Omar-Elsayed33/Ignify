import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.email import build_verification_email, send_email
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.models import (
    CreditBalance,
    Plan,
    RefreshToken,
    Tenant,
    User,
    UserRole,
)
from app.modules.auth.schemas import RegisterRequest, TokenResponse


async def register_user(db: AsyncSession, data: RegisterRequest) -> tuple[User, TokenResponse]:
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise ValueError("Email already registered")

    # Get starter plan
    plan_result = await db.execute(select(Plan).where(Plan.slug == "starter"))
    plan = plan_result.scalar_one_or_none()

    slug = data.company_name.lower().replace(" ", "-").replace("_", "-")
    slug_check = await db.execute(select(Tenant).where(Tenant.slug == slug))
    if slug_check.scalar_one_or_none():
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

    tenant = Tenant(
        name=data.company_name,
        slug=slug,
        plan_id=plan.id if plan else None,
        is_active=True,
    )
    db.add(tenant)
    await db.flush()

    verify_token = secrets.token_urlsafe(48)
    verify_expires = datetime.now(timezone.utc) + timedelta(hours=settings.EMAIL_VERIFICATION_EXPIRE_HOURS)

    user = User(
        tenant_id=tenant.id,
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        role=UserRole.owner,
        lang_preference=data.lang_preference,
        is_active=True,
        email_verified=False,
        email_verification_token=verify_token,
        email_verification_expires=verify_expires,
    )
    db.add(user)

    # Initialize credit balance
    balance = CreditBalance(
        tenant_id=tenant.id,
        balance=plan.max_credits if plan else 500,
    )
    db.add(balance)
    await db.flush()

    # Send verification email (dev = logs to console)
    link = f"{settings.FRONTEND_URL}/{data.lang_preference}/verify?token={verify_token}"
    subject, html, text = build_verification_email(data.full_name, link, data.lang_preference)
    try:
        await send_email(data.email, subject, html, text)
    except Exception:
        pass  # non-fatal in dev

    # Kick off async welcome email (non-fatal)
    try:
        from app.modules.notifications.tasks import send_notification_email
        send_notification_email.delay(str(user.id), "welcome", {})
    except Exception:
        pass

    # Provision OpenRouter sub-key for this tenant (non-fatal)
    try:
        from app.modules.ai_usage.service import provision_tenant_ai_key
        await provision_tenant_ai_key(db, tenant, plan)
    except Exception:
        pass

    tokens = await _issue_tokens(db, user)
    return user, tokens


async def request_verification_email(db: AsyncSession, user_id: uuid.UUID) -> None:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise ValueError("User not found")
    if user.email_verified:
        return

    user.email_verification_token = secrets.token_urlsafe(48)
    user.email_verification_expires = datetime.now(timezone.utc) + timedelta(
        hours=settings.EMAIL_VERIFICATION_EXPIRE_HOURS
    )
    await db.flush()

    link = f"{settings.FRONTEND_URL}/{user.lang_preference}/verify?token={user.email_verification_token}"
    subject, html, text = build_verification_email(user.full_name, link, user.lang_preference)
    await send_email(user.email, subject, html, text)


async def verify_email(db: AsyncSession, token: str) -> User:
    result = await db.execute(select(User).where(User.email_verification_token == token))
    user = result.scalar_one_or_none()
    if not user:
        raise ValueError("invalid")
    if user.email_verified:
        return user
    if not user.email_verification_expires or user.email_verification_expires < datetime.now(timezone.utc):
        raise ValueError("expired")

    user.email_verified = True
    user.email_verified_at = datetime.now(timezone.utc)
    user.email_verification_token = None
    user.email_verification_expires = None
    await db.flush()
    return user


async def login_user(db: AsyncSession, email: str, password: str) -> tuple[User, TokenResponse]:
    result = await db.execute(select(User).where(User.email == email, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        raise ValueError("Invalid email or password")

    if settings.EMAIL_VERIFICATION_REQUIRED and not user.email_verified:
        raise ValueError("email_not_verified")

    # Superadmin: ensure their tenant has a provisioned sub-key for future plan testing
    if user.role == UserRole.superadmin and user.tenant_id:
        try:
            from app.db.models import TenantOpenRouterConfig
            from sqlalchemy import select as sel
            existing = await db.execute(
                sel(TenantOpenRouterConfig).where(TenantOpenRouterConfig.tenant_id == user.tenant_id)
            )
            if existing.scalar_one_or_none() is None:
                tenant_r = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
                tenant = tenant_r.scalar_one_or_none()
                if tenant:
                    from app.modules.ai_usage.service import provision_tenant_ai_key
                    await provision_tenant_ai_key(db, tenant, None)
                    await db.commit()
        except Exception:
            pass  # non-fatal

    tokens = await _issue_tokens(db, user)
    return user, tokens


async def refresh_tokens(db: AsyncSession, refresh_token_str: str) -> TokenResponse:
    payload = decode_token(refresh_token_str)
    if not payload or payload.get("type") != "refresh":
        raise ValueError("Invalid refresh token")

    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token == refresh_token_str,
            RefreshToken.is_revoked == False,
        )
    )
    stored = result.scalar_one_or_none()
    if not stored or stored.expires_at < datetime.now(timezone.utc):
        raise ValueError("Refresh token expired or revoked")

    # Revoke old token
    stored.is_revoked = True

    user_result = await db.execute(select(User).where(User.id == stored.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise ValueError("User not found")

    tokens = await _issue_tokens(db, user)
    return tokens


async def logout_user(db: AsyncSession, refresh_token_str: str) -> None:
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token == refresh_token_str)
    )
    stored = result.scalar_one_or_none()
    if stored:
        stored.is_revoked = True
    await db.flush()


async def _issue_tokens(db: AsyncSession, user: User) -> TokenResponse:
    token_data = {"sub": str(user.id), "tenant_id": str(user.tenant_id), "role": user.role.value}

    access = create_access_token(token_data)
    refresh = create_refresh_token(token_data)

    rt = RefreshToken(
        user_id=user.id,
        token=refresh,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(rt)
    await db.flush()

    return TokenResponse(access_token=access, refresh_token=refresh)
