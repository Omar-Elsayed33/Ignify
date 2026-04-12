"""Shared state schema for VideoAgent graph."""
from __future__ import annotations

from typing import Any, TypedDict


class VideoState(TypedDict, total=False):
    tenant_id: str
    idea: str
    duration_seconds: int              # 15 | 30 | 60
    language: str                      # "ar" | "en" | "both"
    video_type: str                    # "ad" | "educational" | "entertainment"
    aspect_ratio: str                  # "9:16" | "1:1" | "16:9"
    voice_id: str | None
    brand_voice: dict[str, Any]
    script: str | None
    scenes: list[dict[str, Any]]
    voice_url: str | None
    video_url: str | None
    subtitle_url: str | None
    meta: dict[str, Any]
