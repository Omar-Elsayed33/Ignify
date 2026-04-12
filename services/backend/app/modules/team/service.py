"""Team management service: members, invitations, ownership transfer."""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password
from app.db.models import Invitation, RefreshToken, Tenant, User, UserRole
from app.modules.team.schemas import (
    AcceptResponse,
    InvitationPreview,
    InvitationResponse,
    TeamMemberResponse,
    TeamMemberUpdate,
)

INVITE_EXPIRY_DAYS = 7


# ── Helpers ────────────────────────────────────────────────────────────────


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _invitation_status(inv: Invitation, cancelled_ids: Optional[set] = None) -> str:
    if inv.accepted_at is not None:
        return "accepted"
    # We model "cancelled" by deleting invitations; see cancel_invitation.
    if inv.expires_at and inv.expires_at < _now():
        return "expired"
    return "pending"


def _accept_url(token: str, lang: str = "en") -> str:
    base = settings.FRONTEND_URL.rstrip("/")
    return f"{base}/{lang}/accept-invite?token={token}"


async def _get_user_name(db: AsyncSession, user_id: uuid.UUID) -> Optional[str]:
    res = await db.execute(select(User.full_name).where(User.id == user_id))
    return res.scalar_one_or_none()


def _to_member_response(u: User) -> TeamMemberResponse:
    return TeamMemberResponse(
        id=u.id,
        email=u.email,
        full_name=u.full_name,
        role=u.role.value if isinstance(u.role, UserRole) else str(u.role),
        is_active=u.is_active,
        email_verified=u.email_verified,
        last_login=getattr(u, "last_login", None),
        created_at=u.created_at,
    )


async def _to_invitation_response(
    db: AsyncSession, inv: Invitation, lang: str = "en"
) -> InvitationResponse:
    inviter_name = await _get_user_name(db, inv.invited_by) if inv.invited_by else None
    return InvitationResponse(
        id=inv.id,
        email=inv.email,
        role=inv.role.value if isinstance(inv.role, UserRole) else str(inv.role),
        status=_invitation_status(inv),
        invited_by_name=inviter_name,
        created_at=getattr(inv, "created_at", None),
        expires_at=inv.expires_at,
        accept_url=_accept_url(inv.token, lang),
    )


# ── Members ────────────────────────────────────────────────────────────────


async def list_members(db: AsyncSession, tenant_id: uuid.UUID) -> list[TeamMemberResponse]:
    result = await db.execute(
        select(User).where(User.tenant_id == tenant_id).order_by(User.created_at.asc())
    )
    return [_to_member_response(u) for u in result.scalars().all()]


async def update_member(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    data: TeamMemberUpdate,
    actor: User,
) -> TeamMemberResponse:
    if actor.role not in (UserRole.owner, UserRole.admin, UserRole.superadmin):
        raise HTTPException(status_code=403, detail="Not permitted")

    res = await db.execute(
        select(User).where(User.id == user_id, User.tenant_id == tenant_id)
    )
    target = res.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")

    if target.role == UserRole.owner and (data.role is not None or data.is_active is False):
        raise HTTPException(status_code=400, detail="Cannot demote or deactivate owner")

    if data.role is not None:
        if data.role == "owner":
            raise HTTPException(
                status_code=400,
                detail="Use transfer-ownership to promote to owner",
            )
        # Admins can only change editor/viewer roles, not other admins
        if (
            target.role == UserRole.admin
            and actor.role != UserRole.owner
            and actor.role != UserRole.superadmin
        ):
            raise HTTPException(
                status_code=403,
                detail="Only owner can change another admin's role",
            )
        try:
            target.role = UserRole(data.role)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid role")

    if data.is_active is not None:
        target.is_active = data.is_active

    await db.flush()
    await db.refresh(target)
    return _to_member_response(target)


async def remove_member(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    actor: User,
) -> None:
    if actor.role not in (UserRole.owner, UserRole.admin, UserRole.superadmin):
        raise HTTPException(status_code=403, detail="Not permitted")
    if actor.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")

    res = await db.execute(
        select(User).where(User.id == user_id, User.tenant_id == tenant_id)
    )
    target = res.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")
    if target.role == UserRole.owner:
        raise HTTPException(status_code=400, detail="Owner cannot be removed")
    if target.role == UserRole.admin and actor.role == UserRole.admin:
        raise HTTPException(status_code=403, detail="Only owner can remove another admin")

    target.is_active = False
    await db.flush()


async def transfer_ownership(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    new_owner_id: uuid.UUID,
    current_owner: User,
) -> None:
    if current_owner.role != UserRole.owner:
        raise HTTPException(status_code=403, detail="Only owner can transfer ownership")
    if current_owner.id == new_owner_id:
        raise HTTPException(status_code=400, detail="Already the owner")

    res = await db.execute(
        select(User).where(User.id == new_owner_id, User.tenant_id == tenant_id)
    )
    target = res.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Target member not found")
    if not target.is_active:
        raise HTTPException(status_code=400, detail="Target member is inactive")

    # Atomic swap within one flush
    current_owner.role = UserRole.admin
    target.role = UserRole.owner
    await db.flush()


# ── Invitations ────────────────────────────────────────────────────────────


async def create_invitation(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    inviter: User,
    email: str,
    role: str,
    lang: str = "en",
) -> InvitationResponse:
    if role in ("owner", "superadmin"):
        raise HTTPException(status_code=400, detail="Cannot invite as owner/superadmin")
    try:
        role_enum = UserRole(role)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid role")

    # Existing active user within same tenant?
    existing_user = await db.execute(
        select(User).where(User.email == email, User.tenant_id == tenant_id)
    )
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User already a member")

    # Existing pending invitation?
    existing_inv = await db.execute(
        select(Invitation).where(
            Invitation.tenant_id == tenant_id,
            Invitation.email == email,
            Invitation.accepted_at.is_(None),
        )
    )
    pending = existing_inv.scalar_one_or_none()
    if pending and pending.expires_at > _now():
        raise HTTPException(status_code=400, detail="Pending invitation already exists")

    token = secrets.token_urlsafe(48)
    invitation = Invitation(
        tenant_id=tenant_id,
        email=email,
        role=role_enum,
        token=token,
        invited_by=inviter.id,
        expires_at=_now() + timedelta(days=INVITE_EXPIRY_DAYS),
    )
    db.add(invitation)
    await db.flush()
    await db.refresh(invitation)

    # TODO: trigger email sender (left as integration hook)
    return await _to_invitation_response(db, invitation, lang)


async def list_invitations(
    db: AsyncSession, tenant_id: uuid.UUID, lang: str = "en"
) -> list[InvitationResponse]:
    res = await db.execute(
        select(Invitation)
        .where(Invitation.tenant_id == tenant_id, Invitation.accepted_at.is_(None))
        .order_by(Invitation.expires_at.desc())
    )
    return [await _to_invitation_response(db, inv, lang) for inv in res.scalars().all()]


async def cancel_invitation(
    db: AsyncSession, tenant_id: uuid.UUID, invitation_id: uuid.UUID
) -> None:
    res = await db.execute(
        select(Invitation).where(
            Invitation.id == invitation_id, Invitation.tenant_id == tenant_id
        )
    )
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if inv.accepted_at is not None:
        raise HTTPException(status_code=400, detail="Already accepted")
    await db.delete(inv)
    await db.flush()


async def resend_invitation(
    db: AsyncSession, tenant_id: uuid.UUID, invitation_id: uuid.UUID, lang: str = "en"
) -> InvitationResponse:
    res = await db.execute(
        select(Invitation).where(
            Invitation.id == invitation_id, Invitation.tenant_id == tenant_id
        )
    )
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if inv.accepted_at is not None:
        raise HTTPException(status_code=400, detail="Already accepted")

    inv.expires_at = _now() + timedelta(days=INVITE_EXPIRY_DAYS)
    # Rotate token for safety
    inv.token = secrets.token_urlsafe(48)
    await db.flush()
    await db.refresh(inv)
    # TODO: re-send email
    return await _to_invitation_response(db, inv, lang)


async def preview_invitation(db: AsyncSession, token: str) -> InvitationPreview:
    res = await db.execute(select(Invitation).where(Invitation.token == token))
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invalid token")
    if inv.accepted_at is not None:
        raise HTTPException(status_code=400, detail="Invitation already accepted")
    if inv.expires_at < _now():
        raise HTTPException(status_code=400, detail="Invitation expired")

    tenant_res = await db.execute(select(Tenant).where(Tenant.id == inv.tenant_id))
    tenant = tenant_res.scalar_one_or_none()
    inviter_name = await _get_user_name(db, inv.invited_by)

    return InvitationPreview(
        email=inv.email,
        role=inv.role.value if isinstance(inv.role, UserRole) else str(inv.role),
        tenant_name=tenant.name if tenant else "",
        invited_by_name=inviter_name,
        expires_at=inv.expires_at,
    )


async def accept_invitation(
    db: AsyncSession, token: str, password: str, full_name: str
) -> AcceptResponse:
    from app.core.security import create_access_token, create_refresh_token

    res = await db.execute(select(Invitation).where(Invitation.token == token))
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invalid token")
    if inv.accepted_at is not None:
        raise HTTPException(status_code=400, detail="Invitation already accepted")
    if inv.expires_at < _now():
        raise HTTPException(status_code=400, detail="Invitation expired")

    existing = await db.execute(select(User).where(User.email == inv.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User with this email already exists")

    user = User(
        tenant_id=inv.tenant_id,
        email=inv.email,
        password_hash=hash_password(password),
        full_name=full_name,
        role=inv.role,
        is_active=True,
        email_verified=True,
        email_verified_at=_now(),
    )
    db.add(user)
    inv.accepted_at = _now()
    await db.flush()
    await db.refresh(user)

    token_data = {
        "sub": str(user.id),
        "tenant_id": str(user.tenant_id),
        "role": user.role.value,
    }
    access = create_access_token(token_data)
    refresh = create_refresh_token(token_data)

    rt = RefreshToken(
        user_id=user.id,
        token=refresh,
        expires_at=_now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(rt)
    await db.flush()

    return AcceptResponse(access_token=access, refresh_token=refresh)
