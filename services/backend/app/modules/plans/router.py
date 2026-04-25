from __future__ import annotations

import json
import time
import uuid
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import select

from app.agents.plan_modes import load_mode_config
from app.agents.registry import get_agent
from app.agents.tracing import AgentTracer
from app.core.ai_budget import AIBudgetExceeded
from app.core.pdf import build_plan_pdf
from app.core.rate_limit import rate_limit_dep  # noqa: F401 — kept for compat
from app.core.rate_limit_presets import LOOSE, STRICT
from app.db.models import AgentRun, BrandSettings, MarketingPlan, Tenant
from app.dependencies import CurrentUser, CurrentUserFlex, DbSession
from app.modules.plans.schemas import (
    PlanGenerateRequest,
    PlanListItem,
    PlanResponse,
    PlanUpdateSection,
)
from app.modules.plans.service import PlanModeNotAllowed
from app.modules.plans.service import (
    _build_business_profile,
    _persist_plan,
    generate_plan,
    regenerate_plan_section,
)
from app.modules.plans.validators import validate_business_profile
from app.modules.plans.pdf_import import (
    Improvement,
    analyze_plan_pdf,
    build_plan_from_pdf,
    extract_pdf_text,
)
from pydantic import BaseModel, Field


class _RegenerateSectionBody(BaseModel):
    section: str
    language: str = "ar"
    note: str = Field("", max_length=2000)


class _RegenerateFullBody(BaseModel):
    language: str = "ar"
    note: str = Field("", max_length=2000)


_NODE_NAMES = {
    "market",
    "audience",
    "positioning",
    "customer_journey",
    "offer",
    "funnel",
    "channels",
    "conversion",
    "retention",
    "growth_loops",
    "calendar",
    "kpis",
    "ads",
    "execution_roadmap",
}


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


@router.post("/seed-sample", response_model=PlanResponse)
async def seed_sample_plan(user: CurrentUser, db: DbSession):
    """Idempotently create a sample read-only plan for new tenants.

    Returns the existing sample if one was already seeded. Useful for empty-state UX —
    frontend can call this when the plans list is empty to show the user what a finished
    plan looks like without waiting for a 3-minute generation.
    """
    from datetime import date, timedelta

    # Look for existing sample (tagged via title prefix).
    existing = await db.execute(
        select(MarketingPlan).where(
            MarketingPlan.tenant_id == user.tenant_id,
            MarketingPlan.title.like("[SAMPLE]%"),
        ).limit(1)
    )
    found = existing.scalar_one_or_none()
    if found:
        return found

    today = date.today()
    sample = MarketingPlan(
        tenant_id=user.tenant_id,
        title="[SAMPLE] خطة تسويق تجريبية · 30 يوم",
        period_start=today,
        period_end=today + timedelta(days=30),
        plan_mode="fast",
        status="approved",
        version=1,
        primary_goal="زيادة الوعي بالعلامة التجارية + 50 عميلاً محتملاً في 30 يوم",
        budget_monthly_usd=500.0,
        goals=[
            {"goal": "زيادة متابعي انستغرام بنسبة 20%", "kpi": "followers_growth", "target": "+20%"},
            {"goal": "جذب 50 عميلاً محتملاً عبر صفحة هبوط", "kpi": "leads", "target": 50},
            {"goal": "تحقيق 10 مبيعات من الحملة", "kpi": "sales", "target": 10},
        ],
        personas=[
            {
                "name": "سارة، مديرة تسويق شابة",
                "age": "28-35",
                "pain_points": ["ضيق الوقت", "ميزانية محدودة"],
                "channels": ["instagram", "linkedin"],
            },
            {
                "name": "أحمد، صاحب عمل صغير",
                "age": "35-50",
                "pain_points": ["قلة الظهور", "المنافسة الشديدة"],
                "channels": ["facebook", "whatsapp"],
            },
        ],
        channels=[
            {"platform": "instagram", "frequency": "5 منشورات/أسبوع", "content_type": "reels + carousel"},
            {"platform": "facebook", "frequency": "3 منشورات/أسبوع", "content_type": "روابط + فيديوهات"},
            {"platform": "email", "frequency": "1 نشرة/أسبوع", "content_type": "نشرة بريدية"},
        ],
        kpis=[
            {"name": "نسبة التفاعل", "target": "4%", "current": "2.1%"},
            {"name": "تكلفة الاكتساب", "target": "$10", "current": "$18"},
            {"name": "معدل التحويل", "target": "3.5%", "current": "1.8%"},
        ],
        market_analysis={
            "summary": "السوق في مرحلة نمو سريع مع طلب مرتفع وتنافس متوسط.",
            "swot": {
                "strengths": ["منتج عالي الجودة", "فريق متمكن", "علاقات قوية مع العملاء"],
                "weaknesses": ["ميزانية تسويق محدودة", "حضور رقمي ضعيف"],
                "opportunities": ["سوق رقمي متنامٍ", "قلة المنافسين المتخصصين"],
                "threats": ["دخول منافسين كبار", "تغيّر خوارزميات المنصات"],
            },
            "trends": ["تصاعد أهمية الفيديوهات القصيرة", "زيادة الثقة في المحتوى الصادق"],
        },
        positioning={
            "statement": "الخيار الأذكى للأعمال الصغيرة التي تريد تسويقاً فعّالاً بدون تكلفة مرتفعة.",
            "differentiators": ["سرعة التنفيذ", "أسعار منافسة", "دعم عربي 24/7"],
        },
        offer={
            "hero": "احصل على أول شهر تسويق مجاناً عند الاشتراك السنوي.",
            "features": ["إدارة كاملة للقنوات", "تقارير أسبوعية", "مدير حساب مخصص"],
            "pricing_note": "خصم 20% للعملاء الجدد خلال الإطلاق.",
        },
        calendar=[
            {"week": 1, "theme": "تعريف بالعلامة", "posts": 8},
            {"week": 2, "theme": "قصص نجاح العملاء", "posts": 7},
            {"week": 3, "theme": "محتوى تعليمي", "posts": 8},
            {"week": 4, "theme": "عرض الإطلاق", "posts": 9},
        ],
        execution_roadmap=[
            {"week": 1, "tasks": ["إعداد الحسابات", "تصميم هوية المحتوى", "إنشاء 15 قالب"]},
            {"week": 2, "tasks": ["إطلاق أول حملة", "متابعة التفاعل اليومي"]},
            {"week": 3, "tasks": ["تحليل أداء الأسبوعين", "تحسين الاستهداف"]},
            {"week": 4, "tasks": ["إطلاق عرض خاص", "مراجعة شاملة للنتائج"]},
        ],
        funnel={
            "stages": ["الوعي", "الاهتمام", "التفكير", "القرار", "التبني"],
            "conversion_rates": {"awareness_to_interest": "12%", "interest_to_lead": "25%", "lead_to_customer": "15%"},
        },
        conversion={
            "landing_page_elements": ["عنوان قوي", "شهادات عملاء", "CTA واضح", "فيديو توضيحي 60 ثانية"],
            "trust_signals": ["تقييمات 5 نجوم", "ضمان استرداد الأموال", "شهادات أمان الدفع"],
        },
        retention={
            "tactics": ["نشرة بريدية أسبوعية", "برنامج ولاء", "محتوى حصري للمشتركين"],
            "target_retention": "60% بعد 3 أشهر",
        },
        growth_loops={
            "referral": "عرض شهر مجاني لكل إحالة ناجحة",
            "content_seo": "3 مقالات أسبوعياً تستهدف كلمات مفتاحية طويلة",
        },
        customer_journey={
            "touchpoints": ["إعلان إنستغرام", "زيارة الموقع", "اشتراك في النشرة", "محادثة مبيعات", "شراء"],
            "bottlenecks": ["ضعف التحويل من زيارة الموقع إلى اشتراك (3%)"],
        },
        ad_strategy={
            "budget_split": {"facebook_ads": 50, "google_ads": 30, "instagram_ads": 20},
            "top_audiences": ["مهتمون بمنتجات مماثلة خلال آخر 90 يوم", "Lookalike 1% من العملاء الحاليين"],
        },
        created_by=user.id,
    )
    db.add(sample)
    await db.commit()
    await db.refresh(sample)
    return sample


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
            budget_monthly_usd=data.budget_monthly_usd,
            budget_currency=data.budget_currency,
            primary_goal=data.primary_goal,
            urgency_days=data.urgency_days,
            plan_mode=data.plan_mode,
        )
    except AIBudgetExceeded as e:
        # Phase 5 P1: budget gate. Return 402 with structured detail so the
        # frontend can route to the upgrade CTA rather than showing a generic
        # "Plan generation failed" error.
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": f"ai_budget_{e.reason}",
                "message": (
                    "You've reached your monthly AI budget."
                    if e.reason == "limit_reached"
                    else "This plan would exceed your remaining AI budget."
                    if e.reason == "would_exceed"
                    else "Deep-mode plan cap reached for this month."
                ),
                "limit_usd": round(e.limit_usd, 2),
                "usage_usd": round(e.usage_usd, 4),
                "estimated_cost_usd": round(e.estimated_cost_usd, 4),
            },
        ) from None
    except PlanModeNotAllowed as e:
        # Phase 6 P4: tier-gated plan mode. 403 with a code the frontend can
        # route to the pricing page highlighting the tier that unlocks this mode.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "plan_mode_not_available",
                "message": (
                    f"Your current tier ({e.plan_slug}) doesn't include "
                    f"{e.requested_mode.title()} mode. Upgrade to unlock it."
                ),
                "current_plan": e.plan_slug,
                "requested_mode": e.requested_mode,
                "allowed_modes": e.allowed,
            },
        ) from None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Plan generation failed")
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
    plan_mode = data.plan_mode
    model_override = data.model_override
    budget_monthly_usd = data.budget_monthly_usd
    budget_currency = data.budget_currency
    primary_goal = data.primary_goal
    urgency_days = data.urgency_days

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
        input={"title": title, "period_days": period_days, "language": language, "plan_mode": plan_mode},
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
            mode_config = await load_mode_config(db, plan_mode)
            agent = get_agent("strategy", str(tenant_id), model_override=model_override, mode_config=mode_config)
            agent_model = agent.model

            async for event in agent.stream(
                {
                    "tenant_id": str(tenant_id),
                    "business_profile": profile,
                    "language": language,
                    "period_days": period_days,
                    "budget_monthly_usd": budget_monthly_usd if budget_monthly_usd is not None else 500.0,
                    "budget_currency": budget_currency,
                    "primary_goal": primary_goal or "",
                    "urgency_days": urgency_days,
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
                budget_monthly_usd=budget_monthly_usd,
                primary_goal=primary_goal,
                plan_mode=plan_mode,
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


@router.get("/{plan_id}/ai-notes")
async def get_plan_ai_notes(plan_id: uuid.UUID, user: CurrentUser, db: DbSession):
    """Return the realism warnings the guardrails flagged during plan generation.

    Pulled from the latest successful strategy AgentRun for this tenant that
    produced a plan with this id. Returns an empty list when the plan was
    imported (no AgentRun) or when validation found nothing to flag.

    Shape:
        { "warnings": [ {severity, kind, where, message}, ... ],
          "has_errors": bool }
    """
    # Confirm the plan exists and belongs to the caller's tenant.
    plan_result = await db.execute(
        select(MarketingPlan.id).where(
            MarketingPlan.id == plan_id, MarketingPlan.tenant_id == user.tenant_id
        )
    )
    if plan_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Fetch the most recent strategy run for this tenant — the warnings live
    # in its output JSON. We don't store plan_id on AgentRun today, so we
    # approximate by "latest successful strategy run" ordered desc; as long
    # as the user doesn't run parallel generations this is reliable.
    run_result = await db.execute(
        select(AgentRun)
        .where(
            AgentRun.tenant_id == user.tenant_id,
            AgentRun.agent_name == "strategy",
            AgentRun.status == "succeeded",
        )
        .order_by(AgentRun.started_at.desc())
        .limit(1)
    )
    run = run_result.scalar_one_or_none()
    warnings: list = []
    if run and isinstance(run.output, dict):
        raw = run.output.get("_realism_warnings")
        if isinstance(raw, list):
            warnings = raw
    has_errors = any(
        isinstance(w, dict) and w.get("severity") == "error" for w in warnings
    )
    return {"warnings": warnings, "has_errors": has_errors}


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
            db, user.tenant_id, user.id, plan, data.section, data.language, note=data.note
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail="Regeneration failed")
    return plan


@router.post(
    "/{plan_id}/regenerate",
    response_model=PlanResponse,
    dependencies=[STRICT],
)
async def regenerate_full_plan(
    plan_id: uuid.UUID,
    data: _RegenerateFullBody,
    user: CurrentUser,
    db: DbSession,
):
    from app.modules.plans.service import regenerate_full_plan as _regen_full
    result = await db.execute(
        select(MarketingPlan).where(
            MarketingPlan.id == plan_id, MarketingPlan.tenant_id == user.tenant_id
        )
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    try:
        plan = await _regen_full(db, user.tenant_id, user.id, plan, data.language, note=data.note)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail="Regeneration failed")
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

    # Tenant logo + colors + tagline from BrandSettings (white-label / brand-kit) — optional.
    logo_url: str | None = None
    brand_primary: str | None = None
    brand_accent: str | None = None
    brand_tagline: str | None = None
    try:
        brand_res = await db.execute(
            select(BrandSettings).where(BrandSettings.tenant_id == user.tenant_id)
        )
        brand_row = brand_res.scalar_one_or_none()
        if brand_row:
            logo_url = brand_row.logo_url
            brand_primary = getattr(brand_row, "primary_color", None)
            brand_accent = getattr(brand_row, "accent_color", None)
            brand_tagline = getattr(brand_row, "tagline", None)
            if brand_row.brand_name:
                tenant_name = brand_row.brand_name
    except Exception:
        logo_url = None

    try:
        pdf_bytes = build_plan_pdf(
            plan,
            lang=lang,
            tenant_name=tenant_name,
            tenant_logo_url=logo_url,
            brand_primary=brand_primary,
            brand_accent=brand_accent,
            brand_tagline=brand_tagline,
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail="PDF generation failed")

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


# ─── PDF import ─────────────────────────────────────────────────────────────

@router.post("/pdf/analyze", dependencies=[STRICT])
async def pdf_analyze(
    user: CurrentUser,
    file: UploadFile = File(...),
    language: str = Form("ar"),
):
    if not user.tenant_id:
        raise HTTPException(status_code=403, detail="No tenant")
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="file_must_be_pdf")

    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:  # 10 MB cap
        raise HTTPException(status_code=413, detail="file_too_large")

    text = extract_pdf_text(raw)
    if not text.strip():
        raise HTTPException(
            status_code=422,
            detail="could_not_extract_text — PDF may be scanned/image-only",
        )

    analysis = await analyze_plan_pdf(text, language=language)
    return {
        "extracted_text": text,
        "summary": analysis.summary,
        "strengths": analysis.strengths,
        "weaknesses": analysis.weaknesses,
        "improvements": [
            {
                "id": imp.id,
                "title": imp.title,
                "description": imp.description,
                "severity": imp.severity,
            }
            for imp in analysis.improvements
        ],
        "detected_sections": analysis.detected_sections,
        "raw_text_length": analysis.raw_text_length,
    }


class _PdfImportBody(BaseModel):
    text: str
    title: str = "Imported plan"
    language: str = "ar"
    period_days: int = 30
    apply_improvement_ids: list[str] = []
    improvements: list[dict[str, Any]] = []  # full improvement objects from the analyze step


@router.post("/pdf/import", response_model=PlanResponse, dependencies=[STRICT])
async def pdf_import(
    data: _PdfImportBody,
    user: CurrentUser,
    db: DbSession,
):
    if not user.tenant_id:
        raise HTTPException(status_code=403, detail="No tenant")
    if not data.text.strip():
        raise HTTPException(status_code=400, detail="text_required")

    selected_ids = set(data.apply_improvement_ids)
    apply_list: list[Improvement] = []
    for imp in data.improvements:
        if not isinstance(imp, dict):
            continue
        imp_id = str(imp.get("id") or "")
        if imp_id and imp_id in selected_ids:
            apply_list.append(
                Improvement(
                    id=imp_id,
                    title=str(imp.get("title") or ""),
                    description=str(imp.get("description") or ""),
                    severity=str(imp.get("severity") or "medium"),
                )
            )

    try:
        plan = await build_plan_from_pdf(
            db,
            user.tenant_id,
            user.id,
            text=data.text,
            title=data.title,
            language=data.language,
            apply_improvements=apply_list,
            period_days=data.period_days,
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail="PDF import failed")
    return plan
