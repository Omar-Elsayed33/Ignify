from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class BusinessProfile(BaseModel):
    industry: Optional[str] = None
    country: Optional[str] = None
    primary_language: Optional[str] = Field(default="en")
    description: Optional[str] = None
    target_audience: Optional[str] = None
    products: list[str] = Field(default_factory=list)
    competitors: list[str] = Field(default_factory=list)
    website: Optional[str] = None
    business_name: Optional[str] = None
    phone: Optional[str] = None
    business_email: Optional[str] = None


class BrandPayload(BaseModel):
    brand_name: Optional[str] = None
    brand_voice: Optional[str] = None
    tone: Optional[str] = None
    colors: dict[str, Any] = Field(default_factory=dict)
    fonts: dict[str, Any] = Field(default_factory=dict)
    logo_url: Optional[str] = None
    forbidden_words: list[str] = Field(default_factory=list)
    # white-label (optional)
    white_label_enabled: Optional[bool] = None
    custom_domain: Optional[str] = None
    app_name: Optional[str] = None
    favicon_url: Optional[str] = None
    email_sender_name: Optional[str] = None
    email_sender_address: Optional[str] = None
    footer_text: Optional[str] = None
    support_email: Optional[str] = None
    support_url: Optional[str] = None
    hide_powered_by: Optional[bool] = None


class ChannelsPayload(BaseModel):
    channels: list[str] = Field(default_factory=list)


class BrandResponse(BaseModel):
    brand_name: Optional[str] = None
    brand_voice: Optional[str] = None
    tone: Optional[str] = None
    colors: dict[str, Any] = Field(default_factory=dict)
    fonts: dict[str, Any] = Field(default_factory=dict)
    logo_url: Optional[str] = None
    forbidden_words: list[str] = Field(default_factory=list)
    white_label_enabled: bool = False
    custom_domain: Optional[str] = None
    custom_domain_verified: bool = False
    app_name: Optional[str] = None
    favicon_url: Optional[str] = None
    email_sender_name: Optional[str] = None
    email_sender_address: Optional[str] = None
    footer_text: Optional[str] = None
    support_email: Optional[str] = None
    support_url: Optional[str] = None
    hide_powered_by: bool = False


class ChannelsResponse(BaseModel):
    channels: list[str] = Field(default_factory=list)


class AllSettingsResponse(BaseModel):
    business_profile: BusinessProfile
    brand: BrandResponse
    channels: list[str] = Field(default_factory=list)
