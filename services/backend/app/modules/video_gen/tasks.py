"""Celery tasks for asynchronous video rendering.

``generate_video`` no longer blocks the request thread; it creates an
``AgentRun`` with status=pending, enqueues ``render_video_task`` via Celery,
and returns immediately. The task does the heavy agent.run() + MinIO re-upload
+ CreativeAsset persistence.
"""
from __future__ import annotations

import asyncio
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.agents.registry import get_agent
from app.core.config import settings
from app.core.storage import upload_from_url
from app.db.models import AgentRun, AssetType, CreativeAsset
from app.worker import celery_app


def _task_session_maker():
    """Fresh engine per Celery task — NullPool avoids shared asyncpg connections
    misbehaving across Celery's forked workers."""
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool, echo=False)
    return engine, async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def _render_async(
    run_id: str,
    tenant_id: str,
    user_id: str,
    state: dict[str, Any],
) -> dict[str, Any]:
    engine, maker = _task_session_maker()
    started = time.perf_counter()
    try:
        async with maker() as db:
            # Look up the run row we enqueued from the API.
            run = (
                await db.execute(select(AgentRun).where(AgentRun.id == uuid.UUID(run_id)))
            ).scalar_one_or_none()
            if not run:
                return {"status": "error", "message": "AgentRun not found"}

            run.status = "running"
            await db.commit()

            try:
                agent = get_agent("video", tenant_id)
                result = await agent.run(
                    {
                        "tenant_id": tenant_id,
                        "idea": state.get("idea"),
                        "duration_seconds": state.get("duration_seconds"),
                        "language": state.get("language"),
                        "video_type": state.get("video_type"),
                        "aspect_ratio": state.get("aspect_ratio"),
                        "brand_voice": state.get("brand_voice") or {},
                        "scenes": [],
                        "meta": {},
                    },
                    thread_id=f"video:{run.id}",
                )

                script = result.get("script") or ""
                scenes = result.get("scenes") or []
                video_url = result.get("video_url")
                voice_url = result.get("voice_url")
                subtitle_url = result.get("subtitle_url")
                meta = result.get("meta", {}) or {}

                original_video_url = video_url
                original_voice_url = voice_url
                if video_url:
                    try:
                        video_url = await upload_from_url(video_url, filename_hint="video") or video_url
                    except Exception:
                        pass
                if voice_url:
                    try:
                        voice_url = await upload_from_url(voice_url, filename_hint="voice") or voice_url
                    except Exception:
                        pass

                asset = CreativeAsset(
                    tenant_id=uuid.UUID(tenant_id),
                    name=(state.get("idea") or "video")[:120],
                    asset_type=AssetType.video,
                    file_url=video_url,
                    thumbnail_url=None,
                    prompt_used=script,
                    metadata_={
                        "kind": "video",
                        "duration_seconds": state.get("duration_seconds"),
                        "language": state.get("language"),
                        "video_type": state.get("video_type"),
                        "aspect_ratio": state.get("aspect_ratio"),
                        "scenes": scenes,
                        "voice_url": voice_url,
                        "subtitle_url": subtitle_url,
                        "original_video_url": original_video_url,
                        "original_voice_url": original_voice_url,
                        "agent_run_id": str(run.id),
                        "created_by": user_id,
                        **meta,
                    },
                )
                db.add(asset)

                run.status = "succeeded"
                run.model = agent.model
                run.latency_ms = int((time.perf_counter() - started) * 1000)
                run.output = {
                    "asset_id": None,  # set after flush
                    "script": script,
                    "scenes": scenes,
                    "video_url": video_url,
                    "voice_url": voice_url,
                    "subtitle_url": subtitle_url,
                    "meta": meta,
                }
                await db.flush()
                run.output["asset_id"] = str(asset.id)
                await db.commit()
                return {"status": "succeeded", "run_id": run_id, "asset_id": str(asset.id)}
            except Exception as exc:  # noqa: BLE001
                run.status = "failed"
                run.error = str(exc)[:2000]
                run.latency_ms = int((time.perf_counter() - started) * 1000)
                await db.commit()
                return {"status": "failed", "run_id": run_id, "error": str(exc)[:500]}
    finally:
        await engine.dispose()


@celery_app.task(bind=True, name="ignify.render_video")
def render_video_task(
    self,
    run_id: str,
    tenant_id: str,
    user_id: str,
    state: dict[str, Any],
) -> dict[str, Any]:
    return asyncio.run(_render_async(run_id, tenant_id, user_id, state))


async def _cleanup_stale_pending() -> dict[str, Any]:
    """Mark AgentRuns stuck in pending/running > 1 hour as failed."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
    engine, maker = _task_session_maker()
    try:
        async with maker() as db:
            rows = await db.execute(
                select(AgentRun).where(
                    and_(
                        AgentRun.agent_name == "video",
                        AgentRun.status.in_(("pending", "running")),
                        AgentRun.started_at < cutoff,
                    )
                )
            )
            stale = list(rows.scalars().all())
            for r in stale:
                r.status = "failed"
                r.error = (r.error or "") + " [timed out after 1h]"
            if stale:
                await db.commit()
            return {"cleaned": len(stale)}
    finally:
        await engine.dispose()


@celery_app.task(bind=True, name="ignify.cleanup_stale_video_runs")
def cleanup_stale_video_runs(self) -> dict[str, Any]:
    return asyncio.run(_cleanup_stale_pending())
