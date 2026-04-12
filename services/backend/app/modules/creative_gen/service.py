"""Creative generation service."""
from __future__ import annotations

import time
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.registry import get_agent
from app.agents.tracing import AgentTracer
from app.core.image_processing import overlay_logo
from app.core.storage import upload_bytes, upload_from_url
from app.db.models import AgentRun, AssetType, BrandSettings, CreativeAsset


async def _resolve_brand(
    db: AsyncSession, tenant_id: uuid.UUID
) -> BrandSettings | None:
    return (
        await db.execute(select(BrandSettings).where(BrandSettings.tenant_id == tenant_id))
    ).scalar_one_or_none()


async def _resolve_brand_voice(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    override: dict[str, Any] | None,
    brand: BrandSettings | None = None,
) -> dict[str, Any]:
    if override:
        return override
    if not brand:
        brand = await _resolve_brand(db, tenant_id)
    if not brand:
        return {}
    return {
        "tone": getattr(brand, "tone", None),
        "brand_name": getattr(brand, "brand_name", None),
        "colors": getattr(brand, "colors", None) or {},
        "fonts": getattr(brand, "fonts", None) or {},
        "forbidden_words": getattr(brand, "forbidden_words", None) or [],
    }


async def generate_creative(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    *,
    idea: str,
    style: str,
    dimensions: str,
    language: str,
    brand_voice: dict[str, Any] | None,
) -> dict[str, Any]:
    brand = await _resolve_brand(db, tenant_id)
    voice = await _resolve_brand_voice(db, tenant_id, brand_voice, brand=brand)

    run = AgentRun(
        tenant_id=tenant_id,
        agent_name="creative",
        input={
            "idea": idea,
            "style": style,
            "dimensions": dimensions,
            "language": language,
        },
        status="running",
    )
    db.add(run)
    await db.flush()

    started = time.perf_counter()
    tracer = AgentTracer(tenant_id=tenant_id, run_id=run.id)
    try:
        agent = get_agent("creative", str(tenant_id))
        result = await agent.run(
            {
                "tenant_id": str(tenant_id),
                "idea": idea,
                "style": style,
                "dimensions": dimensions,
                "language": language,
                "brand_voice": voice,
                "image_urls": [],
                "meta": {},
            },
            thread_id=f"creative:{run.id}",
            tracer=tracer,
        )

        run.status = "succeeded"
        output = {k: v for k, v in result.items() if k != "tenant_id"}
        output["_traces"] = tracer.traces
        run.output = output
        run.model = agent.model
        run.latency_ms = int((time.perf_counter() - started) * 1000)
    except Exception as e:
        run.status = "failed"
        run.error = str(e)[:2000]
        run.output = {"_traces": tracer.traces}
        run.latency_ms = int((time.perf_counter() - started) * 1000)
        await db.commit()
        raise

    prompt = result.get("prompt") or ""
    image_urls = result.get("image_urls", []) or []
    meta = result.get("meta", {}) or {}

    logo_url = getattr(brand, "logo_url", None) if brand else None
    logo_position = (meta.get("logo_position") if isinstance(meta, dict) else None) or "bottom-right"

    # Phase 8: re-upload Replicate URLs to MinIO for permanent storage, and
    # optionally apply logo overlay. Keep originals as fallback in metadata.
    persisted_urls: list[str] = []
    for idx, replicate_url in enumerate(image_urls):
        stored_url = replicate_url
        overlay_applied = False
        if logo_url:
            try:
                composed = await overlay_logo(
                    replicate_url, logo_url, position=logo_position, opacity=0.85
                )
                uploaded = await upload_bytes(
                    composed, f"creative-{idx}.jpg", content_type="image/jpeg"
                )
                if uploaded:
                    stored_url = uploaded
                    overlay_applied = True
            except Exception:
                overlay_applied = False
        if not overlay_applied:
            # Fall back to plain re-upload
            try:
                stored_url = await upload_from_url(
                    replicate_url, filename_hint=f"creative-{idx}"
                )
            except Exception:
                stored_url = replicate_url
        persisted_urls.append(stored_url or replicate_url)

    # Persist each image as a CreativeAsset row
    assets: list[CreativeAsset] = []
    for idx, url in enumerate(persisted_urls):
        original = image_urls[idx] if idx < len(image_urls) else None
        asset = CreativeAsset(
            tenant_id=tenant_id,
            name=(idea[:120] or "creative") + (f" #{idx + 1}" if len(persisted_urls) > 1 else ""),
            asset_type=AssetType.image,
            file_url=url,
            thumbnail_url=url,
            prompt_used=prompt,
            metadata_={
                "style": style,
                "dimensions": dimensions,
                "language": language,
                "agent_run_id": str(run.id),
                "created_by": str(user_id),
                "negative_prompt": result.get("negative_prompt"),
                "original_url": original,
                "logo_overlay": bool(logo_url),
                "logo_position": logo_position if logo_url else None,
                **meta,
            },
        )
        db.add(asset)
        assets.append(asset)

    await db.commit()
    for a in assets:
        await db.refresh(a)

    return {
        "creative_id": assets[0].id if assets else None,
        "prompt": prompt,
        "image_urls": persisted_urls,
        "assets": [{"creative_id": a.id, "file_url": a.file_url or ""} for a in assets],
        "meta": meta,
    }
