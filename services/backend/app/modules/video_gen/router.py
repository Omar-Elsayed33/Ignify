from __future__ import annotations

import os
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


def _video_gen_enabled() -> bool:
    """Feature-flag video generation off by default.

    Phase 3 P3-1: The VideoRenderer subagent is a stub that does not produce a
    playable MP4. Charging customers for a feature that returns nothing is
    fraudulent. Until we integrate a real renderer (Runway, Replicate video,
    or an internal ffmpeg slideshow), the endpoint returns HTTP 503 with a
    clear "coming soon" message.

    To re-enable after integration, set VIDEO_GEN_ENABLED=1 in the environment.
    """
    return os.environ.get("VIDEO_GEN_ENABLED", "0") in ("1", "true", "True")


def _reel_slideshow_enabled() -> bool:
    """Safer alternative to AI video — ffmpeg-based slideshow from existing
    CreativeAssets. Off by default; enable once the ffmpeg pipeline ships.

    Why separate from video generation: the "image → reel" flow is
    deterministic (concat images + subtitle track + audio) and carries no
    AI quality risk, so it can ship BEFORE real AI video. Keeps the
    product's video capability truthful while the renderer is built.
    """
    return os.environ.get("REEL_SLIDESHOW_ENABLED", "0") in ("1", "true", "True")


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
    if not _video_gen_enabled():
        # Honest failure: no charging, no quota deduction, no fake status=queued.
        # Frontend can show a "Coming soon" placeholder based on the 503 + code.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "video_generation_unavailable",
                "message": (
                    "Video generation is not available yet. Script + voice generation "
                    "work, but the final MP4 renderer is not wired. No quota consumed."
                ),
                "eta": "Q3 2026",
            },
        )
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


# ── Phase 8 P2: safe-mode "Post → Reel" slideshow (image-based video) ──────
#
# No AI video here. This endpoint takes a ContentPost + 1-5 existing
# CreativeAssets and produces a 9:16 slideshow (images + captions + optional
# music). Implementation ships when ffmpeg wiring lands; for now we stub the
# endpoint with a clear "coming soon" state so the frontend can already wire
# the UI and the user sees deliberate product direction, not a broken button.


@router.post("/reel", status_code=status.HTTP_202_ACCEPTED)
async def generate_reel_slideshow(user: CurrentUser, db: DbSession):
    """Post → Reel slideshow.

    Intended pipeline (when enabled):
      1. Pull the linked ContentPost + its approved CreativeAssets.
      2. ffmpeg-concat the images into a 9:16 stream at N sec each.
      3. Overlay caption text segments (already-written Arabic copy works
         here because it's an OVERLAY layer, not generated inside an image).
      4. Optionally add royalty-free background music.
      5. Upload the MP4 to MinIO and return its URL.

    Cost profile: ffmpeg is local compute — fixed cost, no per-run AI spend.
    That's why it's safer to ship than true AI video: we can size the per-
    tenant quota independently of the AI dollar budget.
    """
    if not user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenant")
    if not _reel_slideshow_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "reel_slideshow_unavailable",
                "message": (
                    "Reel slideshow (image → short video) is rolling out. "
                    "You'll be able to stitch your approved creatives into a "
                    "9:16 Reel/TikTok-ready video with caption overlays. No "
                    "AI video spend involved — this is a ffmpeg-based renderer."
                ),
                "eta": "Next sprint",
                "renderer": "ffmpeg-slideshow",
                "ai_cost_impact": "none",
            },
        )
    # Post-enablement body — keep as placeholder so the live endpoint shape
    # is clear for the ffmpeg task when it lands.
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "code": "reel_slideshow_pending_impl",
            "message": "Slideshow renderer enabled but implementation not yet merged.",
        },
    )
