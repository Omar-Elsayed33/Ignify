from __future__ import annotations

import json
import time
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import select

from app.agents.registry import get_agent
from app.agents.tracing import AgentTracer
from app.core.pdf import build_plan_pdf
from app.core.rate_limit import rate_limit_dep  # noqa: F401 — kept for compat
from app.core.rate_limit_presets import LOOSE, STRICT
from app.db.models import AgentRun, MarketingPlan, Tenant
from app.dependencies import CurrentUser, CurrentUserFlex, DbSession
from app.modules.plans.schemas import (
    PlanGenerateRequest,
    PlanListItem,
    PlanResponse,
    PlanUpdateSection,
)
from app.modules.plans.service import (
    _build_business_profile,
    _persist_plan,
    generate_plan,
    regenerate_plan_section,
)
from app.modules.plans.validators import validate_business_profile
from pydantic import BaseModel


class _RegenerateSectionBody(BaseModel):
    section: str
    language: str = "ar"


_NODE_NAMES = {"market", "audience", "channels", "calendar", "kpis", "ads"}


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

router = APIRouter(prefix="/plans", tags=["plans"])


@router.get("/readiness")
async def plan_readiness(user: CurrentUser, db: DbSession):
    """Check whether the tenant's business profile is complete enough to generate a plan."""
    if not user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenant")
    profile = await _build_business_profile(db, user.tenant_id, None)
    result = validate_business_profile(profile)
    return {
        **result,
        "onboarding_url": "/onboarding/business",
    }


@router.get("/", response_model=list[PlanListItem])
async def list_plans(user: CurrentUser, db: DbSession, skip: int = 0, limit: int = 50):
    result = await db.execute(
        select(MarketingPlan)
        .where(MarketingPlan.tenant_id == user.tenant_id)
        .order_by(MarketingPlan.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post(
    "/generate",
    response_model=PlanResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[rate_limit_dep(limit=10, window_seconds=3600, scope="user")],
)
async def generate(data: PlanGenerateRequest, user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenant")
    # Pre-flight: block generation if required business-profile fields are missing.
    profile_for_check = await _build_business_profile(db, user.tenant_id, data.business_profile)
    readiness = validate_business_profile(profile_for_check)
    if not readiness["ok"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "detail": "business_profile_incomplete",
                "missing": readiness["missing"],
                "warnings": readiness["warnings"],
                "onboarding_url": "/onboarding/business",
            },
        )
    try:
        plan = await generate_plan(
            db,
            tenant_id=user.tenant_id,
            user_id=user.id,
            title=data.title,
            period_days=data.period_days,
            language=data.language,
            business_profile=data.business_profile,
            model_override=data.model_override,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Plan generation failed: {e}")
    return plan


@router.post("/generate/stream")
async def generate_stream(
    data: PlanGenerateRequest, user: CurrentUserFlex, db: DbSession
):
    """SSE stream of StrategyAgent progress.

    Emits events:
      - {type: "run_started", run_id}
      - {type: "node_start", node}
      - {type: "node_end", node, summary, duration_ms}
      - {type: "complete", plan_id}
      - {type: "error", message}
    """
    if not user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenant")

    tenant_id = user.tenant_id
    user_id = user.id
    title = data.title
    period_days = data.period_days
    language = data.language
    model_override = data.model_override

    # Prepare state before the streaming generator starts so we can fail fast.
    profile = await _build_business_profile(db, tenant_id, data.business_profile)

    readiness = validate_business_profile(profile)
    if not readiness["ok"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "detail": "business_profile_incomplete",
                "missing": readiness["missing"],
                "warnings": readiness["warnings"],
                "onboarding_url": "/onboarding/business",
            },
        )

    run = AgentRun(
        tenant_id=tenant_id,
        agent_name="strategy",
        input={"title": title, "period_days": period_days, "language": language},
        status="running",
    )
    db.add(run)
    await db.flush()
    await db.commit()
    await db.refresh(run)
    run_id = run.id

    async def event_gen():
        started = time.perf_counter()
        tracer = AgentTracer(tenant_id=tenant_id, run_id=run_id)
        node_started_at: dict[str, float] = {}
        final_state: dict[str, Any] = {}
        agent_model: str | None = None

        yield _sse({"type": "run_started", "run_id": str(run_id)})

        try:
            agent = get_agent("strategy", str(tenant_id), model_override=model_override)
            agent_model = agent.model

            async for event in agent.stream(
                {
                    "tenant_id": str(tenant_id),
                    "business_profile": profile,
                    "language": language,
                    "period_days": period_days,
                },
                thread_id=f"plan:{run_id}",
                tracer=tracer,
            ):
                kind = event.get("event")
                name = event.get("name", "")
                if kind == "on_chain_start" and name in _NODE_NAMES:
                    node_started_at[name] = time.perf_counter()
                    yield _sse({"type": "node_start", "node": name})
                elif kind == "on_chain_end" and name in _NODE_NAMES:
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

            # If we never collected final state (edge: empty stream) fall back
            if not final_state:
                yield _sse({"type": "error", "message": "Agent produced no output"})
                run.status = "failed"
                run.error = "Empty output"
                run.output = {"_traces": tracer.traces}
                run.latency_ms = int((time.perf_counter() - started) * 1000)
                await db.commit()
                return

            plan = await _persist_plan(
                db,
                tenant_id=tenant_id,
                user_id=user_id,
                title=title,
                period_days=period_days,
                final_state=final_state,
                run=run,
                model=agent_model,
                started_perf=started,
                traces=tracer.traces,
            )
            yield _sse({"type": "complete", "plan_id": str(plan.id)})
        except Exception as e:  # noqa: BLE001
            try:
                run.status = "failed"
                run.error = str(e)[:2000]
                run.output = {"_traces": tracer.traces}
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


@router.get("/{plan_id}", response_model=PlanResponse)
async def get_plan(plan_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(MarketingPlan).where(
            MarketingPlan.id == plan_id, MarketingPlan.tenant_id == user.tenant_id
        )
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan


@router.patch("/{plan_id}/section", response_model=PlanResponse, dependencies=[LOOSE])
async def update_section(
    plan_id: uuid.UUID, data: PlanUpdateSection, user: CurrentUser, db: DbSession
):
    result = await db.execute(
        select(MarketingPlan).where(
            MarketingPlan.id == plan_id, MarketingPlan.tenant_id == user.tenant_id
        )
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    setattr(plan, data.section, data.value)
    await db.commit()
    await db.refresh(plan)
    return plan


@router.post(
    "/{plan_id}/regenerate-section",
    response_model=PlanResponse,
    dependencies=[STRICT],
)
async def regenerate_section(
    plan_id: uuid.UUID,
    data: _RegenerateSectionBody,
    user: CurrentUser,
    db: DbSession,
):
    if data.section not in {"goals", "personas", "channels", "calendar", "kpis"}:
        raise HTTPException(status_code=400, detail="Invalid section")
    result = await db.execute(
        select(MarketingPlan).where(
            MarketingPlan.id == plan_id, MarketingPlan.tenant_id == user.tenant_id
        )
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    try:
        plan = await regenerate_plan_section(
            db, user.tenant_id, user.id, plan, data.section, data.language
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Regeneration failed: {e}")
    return plan


@router.get("/{plan_id}/export.pdf")
async def export_plan_pdf(
    plan_id: uuid.UUID,
    user: CurrentUserFlex,
    db: DbSession,
    lang: str = Query("en", pattern="^(ar|en)$"),
):
    result = await db.execute(
        select(MarketingPlan).where(
            MarketingPlan.id == plan_id, MarketingPlan.tenant_id == user.tenant_id
        )
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    tenant_name = ""
    t_res = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    tenant = t_res.scalar_one_or_none()
    if tenant:
        tenant_name = tenant.name

    try:
        pdf_bytes = build_plan_pdf(plan, lang=lang, tenant_name=tenant_name)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}")

    # ASCII-safe fallback + UTF-8 filename* per RFC 5987 for non-Latin titles
    from urllib.parse import quote
    safe_title = "".join(c for c in plan.title if c.isascii() and (c.isalnum() or c in "-_ "))[:40].strip() or "plan"
    ascii_name = f"{safe_title}-{lang}.pdf"
    utf8_name = quote(f"{plan.title}-{lang}.pdf".encode("utf-8"))
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{utf8_name}"},
    )


@router.post("/{plan_id}/approve", response_model=PlanResponse, dependencies=[LOOSE])
async def approve_plan(plan_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(MarketingPlan).where(
            MarketingPlan.id == plan_id, MarketingPlan.tenant_id == user.tenant_id
        )
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    plan.status = "approved"
    await db.commit()
    await db.refresh(plan)
    return plan
