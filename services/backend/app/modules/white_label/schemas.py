from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class WhiteLabelSettings(BaseModel):
    white_label_enabled: bool = False
    custom_domain: Optional[str] = Field(None, max_length=255)
    custom_domain_verified: bool = False
    app_name: Optional[str] = Field(None, max_length=255)
    logo_url: Optional[str] = Field(None, max_length=1000)
    favicon_url: Optional[str] = Field(None, max_length=1000)
    colors: Optional[dict[str, Any]] = None
    email_sender_name: Optional[str] = Field(None, max_length=255)
    email_sender_address: Optional[str] = Field(None, max_length=255)
    footer_text: Optional[str] = None
    support_email: Optional[str] = Field(None, max_length=255)
    support_url: Optional[str] = Field(None, max_length=1000)
    hide_powered_by: bool = False

    # Meta flags for UI
    plan_code: Optional[str] = None
    is_agency: bool = False


class WhiteLabelUpdate(BaseModel):
    white_label_enabled: Optional[bool] = None
    custom_domain: Optional[str] = Field(None, max_length=255)
    app_name: Optional[str] = Field(None, max_length=255)
    logo_url: Optional[str] = Field(None, max_length=1000)
    favicon_url: Optional[str] = Field(None, max_length=1000)
    colors: Optional[dict[str, Any]] = None
    email_sender_name: Optional[str] = Field(None, max_length=255)
    email_sender_address: Optional[str] = Field(None, max_length=255)
    footer_text: Optional[str] = None
    support_email: Optional[str] = Field(None, max_length=255)
    support_url: Optional[str] = Field(None, max_length=1000)
    hide_powered_by: Optional[bool] = None


class DomainVerifyRequest(BaseModel):
    domain: str = Field(..., min_length=3, max_length=255)


class DomainVerifyResponse(BaseModel):
    domain: str
    status: str  # "pending" | "verified"
    expected_cname: str
