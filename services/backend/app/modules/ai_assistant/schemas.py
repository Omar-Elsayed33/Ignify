"""Pydantic schemas for the AI-assisted onboarding/settings endpoints."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class AnalyzeWebsiteRequest(BaseModel):
    url: str
    lang: str = "en"


class AnalyzeLogoRequest(BaseModel):
    logo_url: str


class DiscoverCompetitorsRequest(BaseModel):
    business_name: str
    industry: str = ""
    country: str = ""
    lang: str = "en"
    description: str = ""
    products: list[str] = Field(default_factory=list)
    website: str = ""


class DraftBusinessProfileRequest(BaseModel):
    website_url: str
    lang: str = "en"
    country: str = ""


class GenericResult(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)
