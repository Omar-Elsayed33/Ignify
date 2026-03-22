import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr

from app.db.models import UserRole


class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    company_name: str
    lang_preference: str = "en"


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


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
