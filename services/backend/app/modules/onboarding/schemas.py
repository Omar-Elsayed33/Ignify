from typing import Any, Optional

from pydantic import BaseModel, Field


class BusinessProfileStep(BaseModel):
    industry: str
    country: str
    primary_language: str = Field(default="en")
    description: Optional[str] = None
    target_audience: Optional[str] = None
    products: list[str] = Field(default_factory=list)
    competitors: list[str] = Field(default_factory=list)
    website: Optional[str] = None
    business_name: Optional[str] = None


class BrandVoiceStep(BaseModel):
    tone: str
    forbidden_words: list[str] = Field(default_factory=list)
    colors: dict[str, Any] = Field(default_factory=dict)
    fonts: dict[str, Any] = Field(default_factory=dict)
    logo_url: Optional[str] = None


class ChannelsStep(BaseModel):
    channels: list[str] = Field(default_factory=list)


class OnboardingStatus(BaseModel):
    step: int = 0
    completed: bool = False
    business_profile: Optional[dict[str, Any]] = None
    brand_voice: Optional[dict[str, Any]] = None
    channels: list[str] = Field(default_factory=list)
