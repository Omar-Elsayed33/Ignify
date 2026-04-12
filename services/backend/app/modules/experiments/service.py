"""A/B Content Experiment service."""
from __future__ import annotations

import asyncio
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    ContentExperiment,
    ContentVariant,
    ExperimentStatus,
)
from app.modules.content_gen.service import generate_content


async def list_experiments(db: AsyncSession, tenant_id: uuid.UUID) -> list[ContentExperiment]:
    result = await db.execute(
        select(ContentExperiment)
        .where(ContentExperiment.tenant_id == tenant_id)
        .order_by(ContentExperiment.created_at.desc())
    )
    return list(result.scalars().all())


async def get_experiment(
    db: AsyncSession, tenant_id: uuid.UUID, experiment_id: uuid.UUID
) -> ContentExperiment | None:
    result = await db.execute(
        select(ContentExperiment)
        .options(selectinload(ContentExperiment.variants))
        .where(
            ContentExperiment.id == experiment_id,
            ContentExperiment.tenant_id == tenant_id,
        )
    )
    return result.scalar_one_or_none()


async def create_experiment(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    data: dict[str, Any],
) -> ContentExperiment:
    variants_cfg = data.get("variants") or []
    exp = ContentExperiment(
        tenant_id=tenant_id,
        name=str(data["name"]),
        brief=str(data["brief"]),
        target=str(data.get("target") or "post"),
        channel=data.get("channel"),
        language=str(data.get("language") or "ar"),
        status=ExperimentStatus.draft,
        traffic_split=data.get("traffic_split") or {},
        created_by=user_id,
    )
    db.add(exp)
    await db.flush()

    variant_rows: list[ContentVariant] = []
    for cfg in variants_cfg:
        v = ContentVariant(
            experiment_id=exp.id,
            variant_label=str(cfg.get("variant_label") or "A")[:8],
            model_override=cfg.get("model_override"),
            prompt_override=cfg.get("prompt_override"),
            status="generating",
        )
        db.add(v)
        variant_rows.append(v)

    await db.flush()
    await db.commit()

    # Generate each variant concurrently
    await _generate_variants(db, tenant_id, user_id, exp, variant_rows)

    reloaded = await get_experiment(db, tenant_id, exp.id)
    return reloaded or exp


async def _generate_variants(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    exp: ContentExperiment,
    variants: list[ContentVariant],
) -> None:
    """Invoke ContentAgent per variant in parallel, persist post references."""

    async def _one(v: ContentVariant) -> tuple[uuid.UUID, dict[str, Any] | None, str | None]:
        brief = exp.brief
        if v.prompt_override:
            brief = f"{exp.brief}\n\n[Variant {v.variant_label} directive]: {v.prompt_override}"
        try:
            result = await generate_content(
                db,
                tenant_id,
                user_id,
                brief=brief,
                target=exp.target,
                channel=exp.channel or "",
                language=exp.language,
                brand_voice=None,
                model_override=v.model_override,
            )
            return v.id, result, None
        except Exception as e:  # noqa: BLE001
            return v.id, None, str(e)[:500]

    results = await asyncio.gather(*(_one(v) for v in variants))

    # Re-load variants to set status + post reference
    for variant_id, result, err in results:
        row = (
            await db.execute(select(ContentVariant).where(ContentVariant.id == variant_id))
        ).scalar_one_or_none()
        if not row:
            continue
        if err or not result:
            row.status = "failed"
            row.error = err or "Unknown error"
        else:
            row.status = "ready"
            row.content_post_id = result.get("content_item_id")
    await db.commit()


async def start_experiment(
    db: AsyncSession, exp: ContentExperiment
) -> ContentExperiment:
    exp.status = ExperimentStatus.running
    await db.commit()
    await db.refresh(exp)
    return exp


def _engagement_rate(v: ContentVariant) -> float:
    if v.impressions <= 0:
        # Fall back to raw engagement count so experiments without impression
        # tracking can still declare a winner.
        return float(v.engagements + v.clicks + v.conversions * 3)
    return (v.engagements + v.clicks + v.conversions * 3) / float(v.impressions)


async def complete_experiment(
    db: AsyncSession, tenant_id: uuid.UUID, exp: ContentExperiment
) -> ContentExperiment:
    full = await get_experiment(db, tenant_id, exp.id)
    if not full:
        return exp
    if not full.variants:
        full.status = ExperimentStatus.completed
        await db.commit()
        await db.refresh(full)
        return full
    ranked = sorted(full.variants, key=_engagement_rate, reverse=True)
    winner = ranked[0]
    full.winner_variant_id = winner.id
    full.status = ExperimentStatus.completed
    await db.commit()
    await db.refresh(full)
    return full


async def track_metric(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    variant_id: uuid.UUID,
    metric: str,
    value: int,
) -> ContentVariant | None:
    row = (
        await db.execute(
            select(ContentVariant)
            .join(ContentExperiment, ContentExperiment.id == ContentVariant.experiment_id)
            .where(
                ContentVariant.id == variant_id,
                ContentExperiment.tenant_id == tenant_id,
            )
        )
    ).scalar_one_or_none()
    if not row:
        return None
    current = getattr(row, metric, 0) or 0
    setattr(row, metric, int(current) + int(value))
    await db.commit()
    await db.refresh(row)
    return row
