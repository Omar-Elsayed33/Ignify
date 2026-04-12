"""Team endpoints: members, invitations, ownership transfer."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.core.rate_limit_presets import MEDIUM, PUBLIC_IP
from app.core.rbac import require_permission
from app.db.models import User
from app.dependencies import CurrentUser, DbSession, get_current_user
from app.modules.team import service
from app.modules.team.schemas import (
    AcceptResponse,
    InvitationAccept,
    InvitationCreate,
    InvitationPreview,
    InvitationResponse,
    TeamMemberResponse,
    TeamMemberUpdate,
    TransferOwnership,
)

router = APIRouter(prefix="/team", tags=["team"])


# ── Members ────────────────────────────────────────────────────────────────


@router.get("/members", response_model=list[TeamMemberResponse])
async def list_members(user: CurrentUser, db: DbSession):
    return await service.list_members(db, user.tenant_id)


@router.patch("/members/{user_id}", response_model=TeamMemberResponse, dependencies=[MEDIUM])
async def update_member(
    user_id: uuid.UUID,
    data: TeamMemberUpdate,
    db: DbSession,
    actor: Annotated[User, Depends(require_permission("team.change_role"))],
):
    return await service.update_member(db, actor.tenant_id, user_id, data, actor)


@router.delete(
    "/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[MEDIUM],
)
async def remove_member(
    user_id: uuid.UUID,
    db: DbSession,
    actor: Annotated[User, Depends(require_permission("team.remove"))],
):
    await service.remove_member(db, actor.tenant_id, user_id, actor)
    return None


# ── Invitations ────────────────────────────────────────────────────────────


@router.post(
    "/members/invite",
    response_model=InvitationResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[MEDIUM],
)
async def invite_member(
    data: InvitationCreate,
    db: DbSession,
    actor: Annotated[User, Depends(require_permission("team.invite"))],
    lang: str = Query("en"),
):
    return await service.create_invitation(
        db, actor.tenant_id, actor, data.email, data.role, lang
    )


@router.get("/invitations", response_model=list[InvitationResponse])
async def list_invitations(
    db: DbSession,
    actor: Annotated[User, Depends(require_permission("team.invite"))],
    lang: str = Query("en"),
):
    return await service.list_invitations(db, actor.tenant_id, lang)


@router.delete(
    "/invitations/{invitation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[MEDIUM],
)
async def cancel_invitation(
    invitation_id: uuid.UUID,
    db: DbSession,
    actor: Annotated[User, Depends(require_permission("team.invite"))],
):
    await service.cancel_invitation(db, actor.tenant_id, invitation_id)
    return None


@router.post(
    "/invitations/{invitation_id}/resend",
    response_model=InvitationResponse,
    dependencies=[MEDIUM],
)
async def resend_invitation(
    invitation_id: uuid.UUID,
    db: DbSession,
    actor: Annotated[User, Depends(require_permission("team.invite"))],
    lang: str = Query("en"),
):
    return await service.resend_invitation(db, actor.tenant_id, invitation_id, lang)


# ── Public endpoints (no auth) ─────────────────────────────────────────────


@router.get("/invitations/preview", response_model=InvitationPreview)
async def preview_invitation(token: str, db: DbSession):
    return await service.preview_invitation(db, token)


@router.post("/invitations/accept", response_model=AcceptResponse, dependencies=[PUBLIC_IP])
async def accept_invitation(data: InvitationAccept, db: DbSession):
    return await service.accept_invitation(db, data.token, data.password, data.full_name)


# ── Ownership transfer ─────────────────────────────────────────────────────


@router.post(
    "/transfer-ownership",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[MEDIUM],
)
async def transfer_ownership(
    data: TransferOwnership,
    db: DbSession,
    actor: Annotated[User, Depends(require_permission("team.transfer"))],
):
    await service.transfer_ownership(db, actor.tenant_id, data.new_owner_id, actor)
    return None
