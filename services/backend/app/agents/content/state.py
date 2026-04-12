"""Shared state schema for ContentAgent graph."""
from __future__ import annotations

from typing import Any, TypedDict


class ContentState(TypedDict, total=False):
    tenant_id: str
    brief: str
    target: str                        # "post" | "blog" | "caption" | "ad_copy"
    channel: str                       # e.g., "instagram", "facebook", "tiktok", "blog"
    language: str                      # "ar" | "en" | "both"
    brand_voice: dict[str, Any]        # tone, style, forbidden words, etc.
    draft: str | None
    final: str | None
    title: str | None
    hashtags: list[str]
    meta: dict[str, Any]
