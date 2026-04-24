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
    content_post_id: uuid.UUID | None = None,
    platform: str | None = None,
) -> dict[str, Any]:
    # Phase 8: regen-limit gate. Must run BEFORE we spend money on Replicate.
    # Raises RegenLimitExceeded when the tenant has already hit the cap for
    # this specific content_post_id. Router translates to HTTP 429.
    from app.modules.creative_gen.regen_guard import check_regen_limit
    regen_count = await check_regen_limit(db, tenant_id, content_post_id)

    # Phase 8: resolve the tenant's plan slug so the image generator can
    # route to the right model tier. Fall back to Free (cheapest, safest).
    from app.db.models import Plan, Tenant
    plan_slug: str | None = None
    tenant_row = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    _tenant = tenant_row.scalar_one_or_none()
    if _tenant is not None and _tenant.plan_id is not None:
        plan_row = await db.execute(select(Plan).where(Plan.id == _tenant.plan_id))
        _plan_db = plan_row.scalar_one_or_none()
        if _plan_db is not None:
            plan_slug = _plan_db.slug

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
                # Phase 8 routing + brief inputs. Brief builder (if in graph)
                # consumes content_text/platform; image generator picks the
                # Replicate model from plan_slug.
                "content_text": idea,
                "platform": platform,
                "brand": voice,
                "plan_slug": plan_slug,
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

    # Phase 8 P4: every asset row now carries the full provenance trail so
    # admins can answer "what did we spend, on which model, for which post?"
    # without joining back to agent_runs.
    model_used = (meta.get("model") if isinstance(meta, dict) else None) or "unknown"
    cost_usd = float((meta.get("cost_usd") if isinstance(meta, dict) else 0) or 0)
    quality_label = (meta.get("quality_label") if isinstance(meta, dict) else None) or "Standard"

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
                # Phase 8 P4 provenance fields — required for regen-limit
                # counting, cost audits, and admin spend breakdowns.
                "content_post_id": str(content_post_id) if content_post_id else None,
                "platform": platform,
                "plan_slug": plan_slug,
                "model": model_used,
                "quality_label": quality_label,
                # Cost is divided across outputs so each asset row carries its
                # share — lets admins sum CreativeAsset.cost_per_image for
                # tenant totals without double-counting.
                "cost_usd": round(cost_usd / max(1, len(persisted_urls)), 6),
                "regen_index": regen_count,  # 0 = initial, 1 = first regen
                **{k: v for k, v in meta.items() if k not in {
                    "model", "quality_label", "plan_slug", "cost_usd"
                }},
            },
        )
        db.add(asset)
        assets.append(asset)

    # Phase 8: record actual spend into the ai_budget ledger so content/plan
    # and creative gens all share one monthly cap per tenant.
    if cost_usd > 0:
        try:
            from app.core.ai_budget import record as _budget_record
            await _budget_record(
                db, tenant_id,
                actual_cost_usd=cost_usd,
                feature="creative_gen.image",
                model=model_used,
            )
        except Exception:  # noqa: BLE001
            # Never block asset persistence on ledger write.
            pass

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
