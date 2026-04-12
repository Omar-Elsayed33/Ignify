"""Shared state schema for CompetitorAgent graph."""
from __future__ import annotations

from typing import Any, TypedDict


class CompetitorState(TypedDict, total=False):
    tenant_id: str
    competitor_id: str
    name: str
    urls: list[str]                      # public URLs to scrape (website + socials)
    our_brand: dict[str, Any]            # tenant brand facts for gap comparison
    language: str                        # "ar" | "en"
    scraped: list[dict[str, Any]]        # one dict per url
    analysis: dict[str, Any]             # themes, tone, content_types
    gaps: list[dict[str, Any]]           # opportunities vs us
