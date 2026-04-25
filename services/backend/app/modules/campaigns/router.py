import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.db.models import Campaign, CampaignAudience, CampaignStatus, CampaignStep
from app.dependencies import CurrentUser, DbSession
from app.modules.campaigns.schemas import (
    CampaignAudienceCreate,
    CampaignAudienceResponse,
    CampaignCreate,
    CampaignGenerateRequest,
    CampaignResponse,
    CampaignStepCreate,
    CampaignStepResponse,
    CampaignUpdate,
)

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("/", response_model=list[CampaignResponse])
async def list_campaigns(user: CurrentUser, db: DbSession, skip: int = 0, limit: int = 50):
    result = await db.execute(
        select(Campaign)
        .where(Campaign.tenant_id == user.tenant_id)
        .order_by(Campaign.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/generate", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def generate_campaign(data: CampaignGenerateRequest, user: CurrentUser, db: DbSession):
    """AI generates a full campaign with steps based on user's goal.

    Phase 11 (standardize-openrouter-provider-and-key-naming):
    All LLM text generation flows through OpenRouter via the tenant's
    provisioned sub-key. No more direct OpenAI / Anthropic fallback — and
    no more calls to the external AGNO runtime. Budget is pre-flight-gated
    and actual cost is recorded to the unified ledger.
    """
    from app.modules.assistant.service import get_tenant_ai_config
    from app.core.ai_budget import (
        AIBudgetExceeded,
        check as _budget_check,
        estimate_feature,
    )
    from app.core.llm_json import llm_json

    ai_config = await get_tenant_ai_config(db, user.tenant_id)
    # Honor a tenant's admin-chosen model if set, otherwise default to GPT-4o
    # via OpenRouter. Bare model names (no `/`) get the `openai/` prefix so
    # every call resolves to an OpenRouter-routed endpoint.
    model = ai_config.get("model") or "openai/gpt-4o"
    if "/" not in model:
        model = f"openai/{model}"

    try:
        await _budget_check(
            db, user.tenant_id,
            estimated_cost_usd=estimate_feature("content_gen.generate"),
            feature="campaigns.generate",
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

    prompt = (
        f"Create a marketing campaign plan for the following goal:\n\n"
        f"Goal: {data.goal}\n"
        f"Campaign Type: {data.campaign_type}\n"
        f"Target Audience: {data.target_audience or 'General'}\n"
        f"Budget: {data.budget or 'Not specified'}\n"
        f"Duration: {data.duration_days or 30} days\n\n"
        f"Generate a JSON response with this exact structure:\n"
        f'{{"name": "campaign name", "description": "brief description", '
        f'"steps": [{{"step_order": 1, "action_type": "social_post|email|ad|blog|sms", '
        f'"title": "step title", "content": "the actual content text", '
        f'"platform": "instagram|facebook|twitter|linkedin|email|google_ads|meta_ads", '
        f'"delay_hours": 0}}]}}\n\n'
        f"Create 3-7 actionable steps with real content. Each step should have actual copy/text ready to use."
    )

    try:
        plan = await llm_json(
            db,
            user.tenant_id,
            system=(
                "You are an expert marketing campaign planner. "
                "Always respond with valid JSON only, no markdown code blocks."
            ),
            user=prompt,
            model=model,
            temperature=0.7,
            max_tokens=4096,
        )
    except ValueError:
        raise HTTPException(status_code=502, detail="AI returned invalid campaign plan. Try again.")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail="AI generation failed")

    # Create campaign
    campaign = Campaign(
        tenant_id=user.tenant_id,
        name=plan.get("name", data.goal[:100]),
        campaign_type=data.campaign_type,
        status=CampaignStatus.draft,
        start_date=data.start_date,
        end_date=data.end_date,
        config={
            "goal": data.goal,
            "target_audience": data.target_audience,
            "budget": data.budget,
            "description": plan.get("description", ""),
            "ai_generated": True,
            "model_used": model,
        },
    )
    db.add(campaign)
    await db.flush()

    # Create steps
    for step_data in plan.get("steps", []):
        step = CampaignStep(
            campaign_id=campaign.id,
            step_order=step_data.get("step_order", 1),
            action_type=step_data.get("action_type", "social_post"),
            config={
                "title": step_data.get("title", ""),
                "content": step_data.get("content", ""),
                "platform": step_data.get("platform", ""),
                "status": "pending",
            },
            delay_hours=step_data.get("delay_hours", 0),
        )
        db.add(step)

    await db.flush()
    return campaign


@router.post("/", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(data: CampaignCreate, user: CurrentUser, db: DbSession):
    campaign = Campaign(
        tenant_id=user.tenant_id,
        name=data.name,
        campaign_type=data.campaign_type,
        status=data.status,
        start_date=data.start_date,
        end_date=data.end_date,
        config=data.config or {},
    )
    db.add(campaign)
    await db.flush()
    return campaign


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(campaign_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == user.tenant_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return campaign


@router.put("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(campaign_id: uuid.UUID, data: CampaignUpdate, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == user.tenant_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(campaign, field, value)
    await db.flush()
    return campaign


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(campaign_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == user.tenant_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    await db.delete(campaign)
    await db.flush()


@router.post("/{campaign_id}/launch", response_model=CampaignResponse)
async def launch_campaign(campaign_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == user.tenant_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status != CampaignStatus.draft:
        raise HTTPException(status_code=400, detail="Only draft campaigns can be launched")

    # Get campaign steps
    steps_result = await db.execute(
        select(CampaignStep).where(CampaignStep.campaign_id == campaign_id).order_by(CampaignStep.step_order)
    )
    steps = steps_result.scalars().all()

    # Create content from steps
    from app.db.models import ContentPost, SocialPost
    from datetime import datetime, timezone, timedelta

    now = datetime.now(timezone.utc)
    for step in steps:
        cfg = step.config or {}
        content_text = cfg.get("content", "")
        platform = cfg.get("platform", "")
        title = cfg.get("title", f"Campaign Step {step.step_order}")
        scheduled_at = now + timedelta(hours=step.delay_hours)

        if step.action_type in ("social_post", "ad") and platform:
            # Create a social post
            post = SocialPost(
                tenant_id=user.tenant_id,
                content=content_text,
                platform=platform,
                status="scheduled",
                scheduled_at=scheduled_at,
            )
            db.add(post)

        if step.action_type in ("blog", "email"):
            # Create a content post
            post = ContentPost(
                tenant_id=user.tenant_id,
                title=title,
                body=content_text,
                post_type=step.action_type,
                platform=platform or "website",
                status="draft",
            )
            db.add(post)

        # Mark step as scheduled
        step.config = {**cfg, "status": "scheduled", "scheduled_at": scheduled_at.isoformat()}

    campaign.status = CampaignStatus.active
    await db.flush()
    return campaign


# ── Steps ──


@router.get("/{campaign_id}/steps", response_model=list[CampaignStepResponse])
async def list_steps(campaign_id: uuid.UUID, user: CurrentUser, db: DbSession):
    camp_result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == user.tenant_id)
    )
    if not camp_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    result = await db.execute(
        select(CampaignStep).where(CampaignStep.campaign_id == campaign_id).order_by(CampaignStep.step_order)
    )
    return result.scalars().all()


@router.post("/{campaign_id}/steps", response_model=CampaignStepResponse, status_code=status.HTTP_201_CREATED)
async def create_step(campaign_id: uuid.UUID, data: CampaignStepCreate, user: CurrentUser, db: DbSession):
    camp_result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == user.tenant_id)
    )
    if not camp_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    step = CampaignStep(
        campaign_id=campaign_id,
        step_order=data.step_order,
        action_type=data.action_type,
        config=data.config or {},
        delay_hours=data.delay_hours,
    )
    db.add(step)
    await db.flush()
    return step


# ── Audiences ──


@router.get("/{campaign_id}/audiences", response_model=list[CampaignAudienceResponse])
async def list_audiences(campaign_id: uuid.UUID, user: CurrentUser, db: DbSession):
    camp_result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == user.tenant_id)
    )
    if not camp_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    result = await db.execute(
        select(CampaignAudience).where(CampaignAudience.campaign_id == campaign_id)
    )
    return result.scalars().all()


@router.post("/{campaign_id}/audiences", response_model=CampaignAudienceResponse, status_code=status.HTTP_201_CREATED)
async def create_audience(campaign_id: uuid.UUID, data: CampaignAudienceCreate, user: CurrentUser, db: DbSession):
    camp_result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == user.tenant_id)
    )
    if not camp_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    audience = CampaignAudience(
        campaign_id=campaign_id,
        name=data.name,
        filters=data.filters or {},
        size=data.size,
    )
    db.add(audience)
    await db.flush()
    return audience


@router.get("/{campaign_id}/detail")
async def get_campaign_detail(campaign_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == user.tenant_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    steps_result = await db.execute(
        select(CampaignStep).where(CampaignStep.campaign_id == campaign_id).order_by(CampaignStep.step_order)
    )
    steps = steps_result.scalars().all()

    audiences_result = await db.execute(
        select(CampaignAudience).where(CampaignAudience.campaign_id == campaign_id)
    )
    audiences = audiences_result.scalars().all()

    return {
        "campaign": CampaignResponse.model_validate(campaign),
        "steps": [CampaignStepResponse.model_validate(s) for s in steps],
        "audiences": [CampaignAudienceResponse.model_validate(a) for a in audiences],
    }
