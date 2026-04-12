from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class VideoGenerateRequest(BaseModel):
    idea: str = Field(..., min_length=1)
    duration_seconds: int = Field(30)
    language: str = Field("en", pattern="^(ar|en|both)$")
    video_type: str = Field("ad", pattern="^(ad|educational|entertainment)$")
    aspect_ratio: str = Field("9:16", pattern="^(9:16|1:1|16:9)$")
    brand_voice: dict[str, Any] | None = None


class SceneOut(BaseModel):
    visual_prompt: str = ""
    text_overlay: str = ""
    duration_seconds: int = 0


class VideoQueuedResponse(BaseModel):
    """Returned on 202 Accepted — client should poll ``poll_url``."""

    run_id: uuid.UUID
    status: str = "queued"
    poll_url: str


class VideoRunStatusResponse(BaseModel):
    run_id: uuid.UUID
    status: str
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    latency_ms: Optional[int] = None
    # Populated once status == "succeeded"
    asset_id: Optional[uuid.UUID] = None
    script: Optional[str] = None
    scenes: list[SceneOut] = []
    video_url: Optional[str] = None
    voice_url: Optional[str] = None
    subtitle_url: Optional[str] = None
    meta: dict[str, Any] = {}


# Kept for backward-compat references
class VideoGenerateResponse(VideoRunStatusResponse):
    pass
