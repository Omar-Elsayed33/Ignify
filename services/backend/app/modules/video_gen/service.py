"""Video generation service — async via Celery.

``generate_video`` creates an ``AgentRun`` row with status=pending, enqueues
the ``ignify.render_video`` Celery task, and returns immediately with the
run_id so the client can poll ``/video-gen/runs/{run_id}`` for progress.
"""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AgentRun, BrandSettings


async def _resolve_brand_voice(
    db: AsyncSession, tenant_id: uuid.UUID, override: dict[str, Any] | None
) -> dict[str, Any]:
    if override:
        return override
    brand = (
        await db.execute(select(BrandSettings).where(BrandSettings.tenant_id == tenant_id))
    ).scalar_one_or_none()
    if not brand:
        return {}
    return {
        "tone": getattr(brand, "tone", None),
        "brand_name": getattr(brand, "brand_name", None),
        "colors": getattr(brand, "colors", None) or {},
        "fonts": getattr(brand, "fonts", None) or {},
        "forbidden_words": getattr(brand, "forbidden_words", None) or [],
    }


async def generate_video(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    *,
    idea: str,
    duration_seconds: int,
    language: str,
    video_type: str,
    aspect_ratio: str,
    brand_voice: dict[str, Any] | None,
) -> dict[str, Any]:
    voice = await _resolve_brand_voice(db, tenant_id, brand_voice)

    run = AgentRun(
        tenant_id=tenant_id,
        agent_name="video",
        input={
            "idea": idea,
            "duration_seconds": duration_seconds,
            "language": language,
            "video_type": video_type,
            "aspect_ratio": aspect_ratio,
        },
        status="pending",
    )
    db.add(run)
    await db.flush()
    run_id = run.id
    await db.commit()

    # Enqueue Celery task. Keep the import local so the API process doesn't
    # import Celery task modules at router-registration time.
    from app.modules.video_gen.tasks import render_video_task

    render_video_task.delay(
        str(run_id),
        str(tenant_id),
        str(user_id),
        {
            "idea": idea,
            "duration_seconds": duration_seconds,
            "language": language,
            "video_type": video_type,
            "aspect_ratio": aspect_ratio,
            "brand_voice": voice,
        },
    )

    return {
        "run_id": run_id,
        "status": "queued",
        "poll_url": f"/video-gen/runs/{run_id}",
    }


async def get_video_run(
    db: AsyncSession, tenant_id: uuid.UUID, run_id: uuid.UUID
) -> AgentRun | None:
    result = await db.execute(
        select(AgentRun).where(
            AgentRun.id == run_id,
            AgentRun.tenant_id == tenant_id,
            AgentRun.agent_name == "video",
        )
    )
    return result.scalar_one_or_none()
