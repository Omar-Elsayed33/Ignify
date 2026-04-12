"""Shared state schema for CreativeAgent graph."""
from __future__ import annotations

from typing import Any, TypedDict


class CreativeState(TypedDict, total=False):
    tenant_id: str
    idea: str
    style: str                           # "photo" | "illustration" | "3d" | "minimal" | "anime"
    dimensions: str                      # "1:1" | "9:16" | "16:9" | "4:5"
    language: str                        # "ar" | "en" | "both"
    brand_voice: dict[str, Any]
    prompt: str | None
    negative_prompt: str | None
    image_urls: list[str]
    meta: dict[str, Any]
