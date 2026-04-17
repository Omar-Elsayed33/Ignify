"""Content generation service."""
from __future__ import annotations

import asyncio
import time
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.registry import get_agent
from app.agents.tracing import AgentTracer
from app.db.models import AgentRun, BrandSettings, ContentPost, ContentStatus, PostType, User, UserRole


async def _needs_approval(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    """True when tenant has approval_required=True AND the author is not owner/admin."""
    from app.db.models import Tenant
    tenant_res = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_res.scalar_one_or_none()
    if not tenant or not isinstance(tenant.config, dict):
        return False
    workflow = (tenant.config or {}).get("workflow") or {}
    if not workflow.get("approval_required"):
        return False
    user_res = await db.execute(select(User).where(User.id == user_id))
    u = user_res.scalar_one_or_none()
    if not u:
        return False
    privileged = {UserRole.owner, UserRole.admin, UserRole.superadmin} if hasattr(UserRole, "superadmin") else {UserRole.owner, UserRole.admin}
    return u.role not in privileged


_TARGET_TO_POST_TYPE = {
    "post": PostType.social,
    "caption": PostType.social,
    "blog": PostType.blog,
    "ad_copy": PostType.ad_copy,
}


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


async def generate_content(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    *,
    brief: str,
    target: str,
    channel: str,
    language: str,
    brand_voice: dict[str, Any] | None,
    model_override: str | None,
    plan_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    voice = await _resolve_brand_voice(db, tenant_id, brand_voice)

    run = AgentRun(
        tenant_id=tenant_id,
        agent_name="content",
        input={
            "brief": brief,
            "target": target,
            "channel": channel,
            "language": language,
        },
        status="running",
    )
    db.add(run)
    await db.flush()

    started = time.perf_counter()
    tracer = AgentTracer(tenant_id=tenant_id, run_id=run.id)
    try:
        agent = get_agent("content", str(tenant_id), model_override=model_override)
        result = await agent.run(
            {
                "tenant_id": str(tenant_id),
                "brief": brief,
                "target": target,
                "channel": channel,
                "language": language,
                "brand_voice": voice,
                "hashtags": [],
                "meta": {},
            },
            thread_id=f"content:{run.id}",
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

    draft = result.get("draft")
    final = result.get("final") or draft or ""
    title = result.get("title") or (brief[:120] if brief else "Untitled")
    hashtags = result.get("hashtags", []) or []
    meta = result.get("meta", {}) or {}

    post_type = _TARGET_TO_POST_TYPE.get(target, PostType.social)

    initial_status = (
        ContentStatus.review
        if await _needs_approval(db, tenant_id, user_id)
        else ContentStatus.draft
    )
    post = ContentPost(
        tenant_id=tenant_id,
        title=title[:500],
        body=final,
        post_type=post_type,
        platform=channel or None,
        status=initial_status,
        metadata_={
            **meta,
            "target": target,
            "language": language,
            "hashtags": hashtags,
            "draft": draft,
            "agent_run_id": str(run.id),
            "created_by": str(user_id),
            "plan_id": str(plan_id) if plan_id else None,
        },
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)

    return {
        "content_item_id": post.id,
        "draft": draft,
        "final": final,
        "title": title,
        "hashtags": hashtags,
        "meta": meta,
    }


async def bulk_generate(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    briefs: list[dict[str, Any]],
    concurrency: int = 3,
) -> list[dict[str, Any]]:
    """Generate multiple pieces of content in parallel with a bounded semaphore.

    Each item in `briefs` is expected to look like:
      {"brief": str, "target": str, "channel": str, "language": str,
       "brand_voice": dict | None, "model_override": str | None}

    Returns a list of result dicts (same shape as `generate_content`) or
    `{"error": "..."}` entries for failures, preserving input order.
    """
    sem = asyncio.Semaphore(max(1, concurrency))

    async def _run_one(idx: int, item: dict[str, Any]) -> dict[str, Any]:
        async with sem:
            try:
                result = await generate_content(
                    db,
                    tenant_id,
                    user_id,
                    brief=str(item.get("brief") or ""),
                    target=str(item.get("target") or "post"),
                    channel=str(item.get("channel") or ""),
                    language=str(item.get("language") or "ar"),
                    brand_voice=item.get("brand_voice"),
                    model_override=item.get("model_override"),
                )
                return {"index": idx, "status": "ok", **result}
            except Exception as e:  # noqa: BLE001
                return {"index": idx, "status": "error", "error": str(e)[:500]}

    tasks = [_run_one(i, b) for i, b in enumerate(briefs)]
    return await asyncio.gather(*tasks)
