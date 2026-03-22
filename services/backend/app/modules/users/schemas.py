import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.db.models import UserRole


class UserResponse(BaseModel):
    id: uuid.UUID
    tenant_id: Optional[uuid.UUID] = None
    email: str
    full_name: str
    role: UserRole
    lang_preference: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    lang_preference: Optional[str] = None
    is_active: Optional[bool] = None


class InviteRequest(BaseModel):
    email: str
    role: UserRole = UserRole.viewer
