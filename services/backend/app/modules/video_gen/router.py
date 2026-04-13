from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.gating import enforce_quota
from app.core.rate_limit_presets import STRICT
from app.dependencies import CurrentUser, DbSession
from app.modules.video_gen.schemas import (
    SceneOut,
    VideoGenerateRequest,
    VideoQueuedResponse,
    VideoRunStatusResponse,
)
from app.modules.video_gen.service import generate_video, get_video_run
from app.modules.plans.context import fetch_plan_context

router = APIRouter(prefix="/video-gen", tags=["video-gen"])


@router.post(
    "/generate",
    response_model=VideoQueuedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[
        Depends(enforce_quota("videos")),
        STRICT,
    ],
)
async def generate(data: VideoGenerateRequest, user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenant")
    plan_ctx = await fetch_plan_context(db, user.tenant_id, data.plan_id, data.language)
    effective_idea = f"{plan_ctx}\n\nVideo brief: {data.idea}" if plan_ctx else data.idea
    try:
        result = await generate_video(
            db,
            tenant_id=user.tenant_id,
            user_id=user.id,
            idea=effective_idea,
            duration_seconds=data.duration_seconds,
            language=data.language,
            video_type=data.video_type,
            aspect_ratio=data.aspect_ratio,
            brand_voice=data.brand_voice,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Video enqueue failed: {e}")
    return result


@router.get("/runs/{run_id}", response_model=VideoRunStatusResponse)
async def get_run(run_id: uuid.UUID, user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenant")
    run = await get_video_run(db, user.tenant_id, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    out = run.output or {}
    scenes_raw = out.get("scenes") or []
    scenes = [
        SceneOut(
            visual_prompt=s.get("visual_prompt", "") if isinstance(s, dict) else "",
            text_overlay=s.get("text_overlay", "") if isinstance(s, dict) else "",
            duration_seconds=s.get("duration_seconds", 0) if isinstance(s, dict) else 0,
        )
        for s in scenes_raw
    ]
    asset_id = out.get("asset_id")
    return VideoRunStatusResponse(
        run_id=run.id,
        status=run.status,
        error=run.error,
        started_at=run.started_at,
        finished_at=run.finished_at,
        latency_ms=run.latency_ms,
        asset_id=uuid.UUID(asset_id) if asset_id else None,
        script=out.get("script"),
        scenes=scenes,
        video_url=out.get("video_url"),
        voice_url=out.get("voice_url"),
        subtitle_url=out.get("subtitle_url"),
        meta=out.get("meta") or {},
    )
