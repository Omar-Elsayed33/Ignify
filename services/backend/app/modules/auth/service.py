import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
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

    user = User(
        tenant_id=tenant.id,
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        role=UserRole.owner,
        lang_preference=data.lang_preference,
        is_active=True,
    )
    db.add(user)

    # Initialize credit balance
    balance = CreditBalance(
        tenant_id=tenant.id,
        balance=plan.max_credits if plan else 500,
    )
    db.add(balance)
    await db.flush()

    tokens = await _issue_tokens(db, user)
    return user, tokens


async def login_user(db: AsyncSession, email: str, password: str) -> tuple[User, TokenResponse]:
    result = await db.execute(select(User).where(User.email == email, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        raise ValueError("Invalid email or password")

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
