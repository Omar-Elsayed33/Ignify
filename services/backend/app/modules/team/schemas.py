from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


InvitableRole = Literal["admin", "editor", "viewer"]


class InvitationCreate(BaseModel):
    email: EmailStr
    role: InvitableRole
    message: Optional[str] = None


class InvitationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    role: str
    status: str  # pending | accepted | expired | cancelled
    invited_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    expires_at: datetime
    accept_url: Optional[str] = None


class InvitationPreview(BaseModel):
    email: str
    role: str
    tenant_name: str
    invited_by_name: Optional[str] = None
    expires_at: datetime


class InvitationAccept(BaseModel):
    token: str
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=255)


class TeamMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    email_verified: bool
    last_login: Optional[datetime] = None
    created_at: datetime


class TeamMemberUpdate(BaseModel):
    role: Optional[Literal["admin", "editor", "viewer"]] = None
    is_active: Optional[bool] = None


class TransferOwnership(BaseModel):
    new_owner_id: uuid.UUID


class AcceptResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
