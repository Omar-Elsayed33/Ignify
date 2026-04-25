from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select

from app.core.gating import enforce_quota
from app.core.rate_limit import rate_limit_dep
from app.db.models import CreativeAsset
from app.dependencies import CurrentUser, DbSession
from app.modules.creative_gen.schemas import (
    CreativeAssetResponse,
    CreativeGenerateRequest,
    CreativeGenerateResponse,
)
from app.modules.creative_gen.service import generate_creative
from app.modules.plans.context import fetch_plan_context

router = APIRouter(prefix="/creative-gen", tags=["creative-gen"])


@router.post(
    "/generate",
    response_model=CreativeGenerateResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[
        Depends(enforce_quota("images")),
        rate_limit_dep(limit=30, window_seconds=3600, scope="user"),
    ],
)
async def generate(data: CreativeGenerateRequest, user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenant")

    # Phase 6 P5: AI cost safety. Replicate image gens are cheap individually
    # (~$0.02) but a tenant could batch thousands and burn the dollar budget
    # even with images-per-month quota remaining.
    from app.core.ai_budget import (
        AIBudgetExceeded,
        check as _budget_check,
        estimate_feature,
    )
    try:
        await _budget_check(
            db, user.tenant_id,
            estimated_cost_usd=estimate_feature("creative_gen.image"),
            feature="creative_gen.image",
        )
    except AIBudgetExceeded as e:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": f"ai_budget_{e.reason}",
                "message": "Monthly AI budget reached — upgrade your plan to continue.",
                "limit_usd": round(e.limit_usd, 2),
                "usage_usd": round(e.usage_usd, 4),
            },
        ) from None

    plan_ctx = await fetch_plan_context(db, user.tenant_id, data.plan_id, data.language)
    effective_idea = f"{plan_ctx}\n\nCreative brief: {data.idea}" if plan_ctx else data.idea
    # Phase 8: regen-limit + model-router errors need distinct HTTP codes so
    # the frontend can show the right UX (regen cap → "already tried once",
    # budget → upgrade CTA, etc.).
    from app.modules.creative_gen.regen_guard import (
        MAX_GENERATIONS_PER_POST,
        RegenLimitExceeded,
    )
    try:
        result = await generate_creative(
            db,
            tenant_id=user.tenant_id,
            user_id=user.id,
            idea=effective_idea,
            style=data.style,
            dimensions=data.dimensions,
            language=data.language,
            brand_voice=data.brand_voice,
            content_post_id=data.content_post_id,
            platform=data.platform,
        )
    except RegenLimitExceeded as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "creative_regen_limit_reached",
                "message": (
                    f"You've already generated {e.existing_count} creative(s) "
                    f"for this post. Limit is {MAX_GENERATIONS_PER_POST} per "
                    "content post. Edit the source content instead of "
                    "regenerating images."
                ),
                "existing_count": e.existing_count,
                "limit": MAX_GENERATIONS_PER_POST,
                "content_post_id": str(e.content_post_id),
            },
        ) from None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Creative generation failed")
    return result


@router.get("/assets", response_model=list[CreativeAssetResponse])
async def list_assets(
    user: CurrentUser,
    db: DbSession,
    asset_type: str | None = Query(None, description="Filter by asset type"),
    search: str | None = Query(None),
    since: datetime | None = Query(None),
    until: datetime | None = Query(None),
    skip: int = 0,
    limit: int = 100,
):
    if not user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenant")
    stmt = select(CreativeAsset).where(CreativeAsset.tenant_id == user.tenant_id)
    if asset_type and asset_type != "all":
        stmt = stmt.where(CreativeAsset.asset_type == asset_type)
    if search:
        like = f"%{search}%"
        stmt = stmt.where(CreativeAsset.name.ilike(like))
    if since:
        stmt = stmt.where(CreativeAsset.created_at >= since)
    if until:
        stmt = stmt.where(CreativeAsset.created_at <= until)
    stmt = stmt.order_by(CreativeAsset.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.delete("/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(asset_id: uuid.UUID, user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenant")
    result = await db.execute(
        select(CreativeAsset).where(
            CreativeAsset.id == asset_id,
            CreativeAsset.tenant_id == user.tenant_id,
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    await db.delete(asset)
    await db.commit()
