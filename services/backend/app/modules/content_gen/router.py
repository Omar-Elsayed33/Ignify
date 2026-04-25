from __future__ import annotations

import json
import time
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.agents.registry import get_agent
from app.core.gating import enforce_quota
from app.core.rate_limit import rate_limit_dep
from app.db.models import AgentRun, ContentPost, ContentStatus, PostType
from app.dependencies import CurrentUser, CurrentUserFlex, DbSession
from app.modules.content_gen.schemas import (
    BulkGenerateRequest,
    BulkGenerateResponse,
    ContentGenerateRequest,
    ContentGenerateResponse,
)
from app.modules.content_gen.service import (
    _resolve_brand_voice,
    bulk_generate,
    generate_content,
)
from app.modules.plans.context import fetch_plan_context

router = APIRouter(prefix="/content-gen", tags=["content-gen"])


_CONTENT_NODES = {"copywriter", "blogger", "caption_writer", "brand_guard", "translator"}


def _sse(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, default=str)}\n\n"


def _summarize(obj: Any) -> Any:
    if isinstance(obj, dict):
        out: dict[str, Any] = {}
        for k, v in obj.items():
            if k == "tenant_id":
                continue
            if isinstance(v, list):
                out[k] = f"{len(v)} items"
            elif isinstance(v, str):
                out[k] = v[:200]
            elif isinstance(v, dict):
                out[k] = f"{len(v)} keys"
            else:
                out[k] = type(v).__name__
        return out
    if isinstance(obj, str):
        return obj[:200]
    return str(type(obj).__name__)


_TARGET_TO_POST_TYPE = {
    "post": PostType.social,
    "caption": PostType.social,
    "blog": PostType.blog,
    "ad_copy": PostType.ad_copy,
}


@router.post(
    "/generate",
    response_model=ContentGenerateResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[
        Depends(enforce_quota("articles")),
        rate_limit_dep(limit=60, window_seconds=3600, scope="user"),
    ],
)
async def generate(data: ContentGenerateRequest, user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenant")

    # Phase 6 P5: AI cost safety. `enforce_quota` above counts article rows,
    # but dollar-spend is a separate concern — a tenant can have articles
    # quota remaining while being out of AI budget. Gate on both.
    from app.core.ai_budget import (
        AIBudgetExceeded,
        check as _budget_check,
        estimate_feature,
    )
    est = estimate_feature("content_gen.generate") * max(1, data.variants)
    try:
        await _budget_check(
            db, user.tenant_id,
            estimated_cost_usd=est,
            feature="content_gen.generate",
        )
    except AIBudgetExceeded as e:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": f"ai_budget_{e.reason}",
                "message": (
                    "Monthly AI budget reached — upgrade your plan to continue."
                    if e.reason == "limit_reached"
                    else "This request would exceed your remaining AI budget."
                ),
                "limit_usd": round(e.limit_usd, 2),
                "usage_usd": round(e.usage_usd, 4),
                "estimated_cost_usd": round(e.estimated_cost_usd, 4),
            },
        ) from None

    plan_ctx = await fetch_plan_context(db, user.tenant_id, data.plan_id, data.language)
    effective_brief = f"{plan_ctx}\n\n{data.brief}" if plan_ctx else data.brief

    if data.variants > 1:
        import asyncio

        async def _one():
            return await generate_content(
                db,
                tenant_id=user.tenant_id,
                user_id=user.id,
                brief=effective_brief,
                target=data.target,
                channel=data.channel,
                language=data.language,
                brand_voice=data.brand_voice,
                model_override=data.model_override,
                plan_id=data.plan_id,
            )

        try:
            # Run N generations sequentially (sharing the same DB session can't be concurrent).
            variants = []
            for _ in range(data.variants):
                variants.append(await _one())
        except Exception as e:
            raise HTTPException(status_code=500, detail="Content generation failed")
        # Return the first variant in the primary fields, plus all as `variants` for frontend.
        primary = variants[0]
        return {**primary, "variants": variants}

    try:
        result = await generate_content(
            db,
            tenant_id=user.tenant_id,
            user_id=user.id,
            brief=effective_brief,
            target=data.target,
            channel=data.channel,
            language=data.language,
            brand_voice=data.brand_voice,
            model_override=data.model_override,
            plan_id=data.plan_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Content generation failed")
    return result


@router.post("/image-suggestions")
async def image_suggestions(data: dict, user: CurrentUser, db: DbSession):
    """Generate 4 image thumbnails to accompany a just-generated piece of content.

    Body: `{content: str, language: str = "ar", count: int = 4}`. Delegates to the creative
    generator N times with slight style variations and returns the image URLs.
    """
    from app.modules.creative_gen.service import generate_creative

    content = str(data.get("content", "")).strip()
    if not content:
        raise HTTPException(status_code=400, detail="content_required")
    language = data.get("language", "ar")
    count = int(data.get("count", 4))
    count = max(1, min(count, 4))

    # Derive 4 distinct style seeds.
    styles = ["modern clean", "bold illustrative", "minimal photography", "bright gradient"]

    results = []
    for i in range(count):
        try:
            res = await generate_creative(
                db,
                tenant_id=user.tenant_id,
                user_id=user.id,
                idea=content[:400],
                style=styles[i % len(styles)],
                dimensions="1080x1080",
                language=language,
                brand_voice=None,
            )
            results.append({
                "style": styles[i % len(styles)],
                "url": res.get("final_url") or res.get("url") or res.get("image_url"),
                "asset_id": res.get("asset_id"),
            })
        except Exception as e:  # noqa: BLE001
            results.append({"style": styles[i % len(styles)], "error": str(e)[:200]})

    return {"count": len(results), "suggestions": results}


@router.post("/bulk-generate", response_model=BulkGenerateResponse)
async def bulk_generate_endpoint(
    data: BulkGenerateRequest, user: CurrentUser, db: DbSession
):
    if not user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenant")
    if not data.items:
        return BulkGenerateResponse(results=[])
    try:
        results = await bulk_generate(
            db,
            user.tenant_id,
            user.id,
            [i.model_dump() for i in data.items],
            concurrency=data.concurrency,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Bulk generation failed")
    return BulkGenerateResponse(results=results)


@router.post("/generate/stream")
async def generate_stream(
    data: ContentGenerateRequest, user: CurrentUserFlex, db: DbSession
):
    """SSE stream of ContentAgent progress."""
    if not user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenant")

    tenant_id = user.tenant_id
    user_id = user.id
    voice = await _resolve_brand_voice(db, tenant_id, data.brand_voice)
    plan_ctx = await fetch_plan_context(db, tenant_id, data.plan_id, data.language)
    effective_brief = f"{plan_ctx}\n\n{data.brief}" if plan_ctx else data.brief

    run = AgentRun(
        tenant_id=tenant_id,
        agent_name="content",
        input={
            "brief": data.brief,
            "target": data.target,
            "channel": data.channel,
            "language": data.language,
        },
        status="running",
    )
    db.add(run)
    await db.flush()
    await db.commit()
    await db.refresh(run)
    run_id = run.id

    async def event_gen():
        started = time.perf_counter()
        node_started_at: dict[str, float] = {}
        final_state: dict[str, Any] = {}

        yield _sse({"type": "run_started", "run_id": str(run_id)})

        try:
            agent = get_agent(
                "content", str(tenant_id), model_override=data.model_override
            )
            async for event in agent.stream(
                {
                    "tenant_id": str(tenant_id),
                    "brief": effective_brief,
                    "target": data.target,
                    "channel": data.channel,
                    "language": data.language,
                    "brand_voice": voice,
                    "hashtags": [],
                    "meta": {"plan_id": str(data.plan_id) if data.plan_id else None},
                },
                thread_id=f"content:{run_id}",
            ):
                kind = event.get("event")
                name = event.get("name", "")
                if kind == "on_chain_start" and name in _CONTENT_NODES:
                    node_started_at[name] = time.perf_counter()
                    yield _sse({"type": "node_start", "node": name})
                elif kind == "on_chain_end" and name in _CONTENT_NODES:
                    data_out = event.get("data", {}) or {}
                    output = data_out.get("output", {}) or {}
                    if isinstance(output, dict):
                        final_state.update(
                            {k: v for k, v in output.items() if k != "tenant_id"}
                        )
                    dur = None
                    if name in node_started_at:
                        dur = int((time.perf_counter() - node_started_at[name]) * 1000)
                    yield _sse(
                        {
                            "type": "node_end",
                            "node": name,
                            "summary": _summarize(output),
                            "duration_ms": dur,
                        }
                    )

            if not final_state:
                yield _sse({"type": "error", "message": "Agent produced no output"})
                run.status = "failed"
                run.error = "Empty output"
                run.latency_ms = int((time.perf_counter() - started) * 1000)
                await db.commit()
                return

            # Persist ContentPost
            draft = final_state.get("draft")
            final = final_state.get("final") or draft or ""
            title = final_state.get("title") or (data.brief[:120] if data.brief else "Untitled")
            hashtags = final_state.get("hashtags", []) or []
            meta = final_state.get("meta", {}) or {}
            post_type = _TARGET_TO_POST_TYPE.get(data.target, PostType.social)

            post = ContentPost(
                tenant_id=tenant_id,
                title=title[:500],
                body=final,
                post_type=post_type,
                platform=data.channel or None,
                status=ContentStatus.draft,
                metadata_={
                    **meta,
                    "target": data.target,
                    "language": data.language,
                    "hashtags": hashtags,
                    "draft": draft,
                    "agent_run_id": str(run_id),
                    "created_by": str(user_id),
                    "plan_id": str(data.plan_id) if data.plan_id else None,
                },
            )
            db.add(post)

            run.status = "succeeded"
            run.output = {k: v for k, v in final_state.items() if k != "tenant_id"}
            run.model = agent.model
            run.latency_ms = int((time.perf_counter() - started) * 1000)

            await db.commit()
            await db.refresh(post)

            yield _sse({"type": "complete", "content_item_id": str(post.id)})
        except Exception as e:  # noqa: BLE001
            try:
                run.status = "failed"
                run.error = str(e)[:2000]
                run.latency_ms = int((time.perf_counter() - started) * 1000)
                await db.commit()
            except Exception:
                pass
            yield _sse({"type": "error", "message": str(e)[:500]})

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
