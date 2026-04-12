import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.db.models import SEOAudit, SEOKeyword, SEORanking
from app.dependencies import CurrentUser, DbSession
from app.modules.seo.schemas import (
    SEOAuditCreate,
    SEOAuditResponse,
    SEOKeywordCreate,
    SEOKeywordResponse,
    SEOKeywordUpdate,
    SEORankingResponse,
)

router = APIRouter(prefix="/seo", tags=["seo"])


# ── Keywords ──


@router.get("/keywords", response_model=list[SEOKeywordResponse])
async def list_keywords(user: CurrentUser, db: DbSession, skip: int = 0, limit: int = 100):
    result = await db.execute(
        select(SEOKeyword)
        .where(SEOKeyword.tenant_id == user.tenant_id)
        .order_by(SEOKeyword.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/keywords", response_model=SEOKeywordResponse, status_code=status.HTTP_201_CREATED)
async def create_keyword(data: SEOKeywordCreate, user: CurrentUser, db: DbSession):
    keyword = SEOKeyword(
        tenant_id=user.tenant_id,
        keyword=data.keyword,
        search_volume=data.search_volume,
        difficulty=data.difficulty,
        current_rank=data.current_rank,
        target_url=data.target_url,
    )
    db.add(keyword)
    await db.flush()
    return keyword


@router.get("/keywords/{keyword_id}", response_model=SEOKeywordResponse)
async def get_keyword(keyword_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(SEOKeyword).where(SEOKeyword.id == keyword_id, SEOKeyword.tenant_id == user.tenant_id)
    )
    keyword = result.scalar_one_or_none()
    if not keyword:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Keyword not found")
    return keyword


@router.put("/keywords/{keyword_id}", response_model=SEOKeywordResponse)
async def update_keyword(keyword_id: uuid.UUID, data: SEOKeywordUpdate, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(SEOKeyword).where(SEOKeyword.id == keyword_id, SEOKeyword.tenant_id == user.tenant_id)
    )
    keyword = result.scalar_one_or_none()
    if not keyword:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Keyword not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(keyword, field, value)
    await db.flush()
    return keyword


@router.delete("/keywords/{keyword_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_keyword(keyword_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(SEOKeyword).where(SEOKeyword.id == keyword_id, SEOKeyword.tenant_id == user.tenant_id)
    )
    keyword = result.scalar_one_or_none()
    if not keyword:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Keyword not found")
    await db.delete(keyword)
    await db.flush()


# ── Rankings ──


@router.get("/keywords/{keyword_id}/rankings", response_model=list[SEORankingResponse])
async def get_keyword_rankings(keyword_id: uuid.UUID, user: CurrentUser, db: DbSession):
    kw_result = await db.execute(
        select(SEOKeyword).where(SEOKeyword.id == keyword_id, SEOKeyword.tenant_id == user.tenant_id)
    )
    if not kw_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Keyword not found")
    result = await db.execute(
        select(SEORanking).where(SEORanking.keyword_id == keyword_id).order_by(SEORanking.date.desc())
    )
    return result.scalars().all()


# ── Audits ──


@router.get("/audits", response_model=list[SEOAuditResponse])
async def list_audits(user: CurrentUser, db: DbSession, skip: int = 0, limit: int = 50):
    result = await db.execute(
        select(SEOAudit)
        .where(SEOAudit.tenant_id == user.tenant_id)
        .order_by(SEOAudit.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/audits", response_model=SEOAuditResponse, status_code=status.HTTP_201_CREATED)
async def create_audit(data: SEOAuditCreate, user: CurrentUser, db: DbSession):
    """Run AI-powered SEO audit based on tenant's website and keywords."""
    import httpx
    from app.core.config import settings
    from app.modules.assistant.service import get_tenant_ai_config
    from app.db.models import Tenant

    # Get tenant info for website
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    tenant = tenant_result.scalar_one_or_none()
    tenant_cfg = (tenant.config or {}) if tenant else {}
    website = tenant_cfg.get("website", "Not provided")
    business_name = tenant_cfg.get("business_name", tenant.name if tenant else "Unknown")

    # Get existing keywords
    kw_result = await db.execute(
        select(SEOKeyword).where(SEOKeyword.tenant_id == user.tenant_id).limit(20)
    )
    keywords = kw_result.scalars().all()
    kw_list = ", ".join([k.keyword for k in keywords]) if keywords else "No keywords tracked yet"

    # Get AI config
    ai_config = await get_tenant_ai_config(db, user.tenant_id)
    provider = ai_config.get("provider") or ""
    api_key = ai_config.get("api_key") or ""
    model = ai_config.get("model") or ""

    if not provider or not api_key:
        if settings.OPENAI_API_KEY:
            provider, api_key, model = "openai", settings.OPENAI_API_KEY, model or "gpt-4o"
        elif settings.ANTHROPIC_API_KEY:
            provider, api_key, model = "anthropic", settings.ANTHROPIC_API_KEY, model or "claude-sonnet-4-20250514"

    score = None
    issues = []
    recommendations = []

    if provider and api_key:
        prompt = (
            f"Perform a comprehensive SEO audit for this business:\n\n"
            f"Business: {business_name}\n"
            f"Website: {website}\n"
            f"Tracked Keywords: {kw_list}\n"
            f"Audit Type: {data.audit_type}\n\n"
            f"Respond with ONLY valid JSON (no markdown), this exact structure:\n"
            f'{{"score": 75, '
            f'"issues": [{{"severity": "high", "category": "technical", "title": "issue title", "description": "details"}}], '
            f'"recommendations": [{{"priority": "high", "category": "content", "title": "recommendation", "description": "what to do", "impact": "expected impact"}}], '
            f'"summary": "Overall SEO health summary"}}\n\n'
            f"Include 5-10 realistic issues and 5-10 actionable recommendations. "
            f"Score from 0-100. Categories: technical, content, on-page, off-page, performance, mobile."
        )

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{settings.AGNO_RUNTIME_URL}/execute",
                    json={
                        "provider": provider,
                        "api_key": api_key,
                        "model": model or "gpt-4o",
                        "system_prompt": "You are an expert SEO analyst. Always respond with valid JSON only.",
                        "messages": [{"role": "user", "content": prompt}],
                        "tools": [],
                        "temperature": 0.7,
                        "max_tokens": 4096,
                    },
                )
                if resp.status_code == 200:
                    import json as json_module
                    ai_text = resp.json().get("response", "")
                    clean = ai_text.strip()
                    if clean.startswith("```"):
                        clean = clean.split("\n", 1)[1] if "\n" in clean else clean[3:]
                        clean = clean.rsplit("```", 1)[0]
                    try:
                        parsed = json_module.loads(clean)
                        score = parsed.get("score")
                        issues = parsed.get("issues", [])
                        recommendations = parsed.get("recommendations", [])
                        # Add summary to recommendations if present
                        if parsed.get("summary"):
                            recommendations.insert(0, {
                                "priority": "info",
                                "category": "summary",
                                "title": "Audit Summary",
                                "description": parsed["summary"],
                                "impact": "",
                            })
                    except json_module.JSONDecodeError:
                        issues = [{"severity": "info", "category": "audit", "title": "AI Analysis", "description": ai_text}]
                        score = None
        except Exception as e:
            issues = [{"severity": "error", "category": "system", "title": "Audit Failed", "description": str(e)}]

    else:
        issues = [{"severity": "info", "category": "config", "title": "No AI Provider", "description": "Configure an AI provider in Settings > AI Configuration to enable SEO audits."}]

    audit = SEOAudit(
        tenant_id=user.tenant_id,
        audit_type=data.audit_type,
        score=score,
        issues=issues,
        recommendations=recommendations,
    )
    db.add(audit)
    await db.flush()
    return audit


@router.post("/keywords/{keyword_id}/analyze", response_model=SEOKeywordResponse)
async def analyze_keyword(keyword_id: uuid.UUID, user: CurrentUser, db: DbSession):
    """AI-analyze a keyword for search volume, difficulty, and ranking suggestions."""
    import httpx
    from app.core.config import settings
    from app.modules.assistant.service import get_tenant_ai_config
    from app.db.models import Tenant

    result = await db.execute(
        select(SEOKeyword).where(SEOKeyword.id == keyword_id, SEOKeyword.tenant_id == user.tenant_id)
    )
    keyword = result.scalar_one_or_none()
    if not keyword:
        raise HTTPException(status_code=404, detail="Keyword not found")

    tenant_result = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    tenant = tenant_result.scalar_one_or_none()
    tenant_cfg = (tenant.config or {}) if tenant else {}
    website = tenant_cfg.get("website", "")
    industry = tenant_cfg.get("industry", "")

    ai_config = await get_tenant_ai_config(db, user.tenant_id)
    provider = ai_config.get("provider") or ""
    api_key = ai_config.get("api_key") or ""
    model = ai_config.get("model") or ""

    if not provider or not api_key:
        if settings.OPENAI_API_KEY:
            provider, api_key, model = "openai", settings.OPENAI_API_KEY, model or "gpt-4o"
        elif settings.ANTHROPIC_API_KEY:
            provider, api_key, model = "anthropic", settings.ANTHROPIC_API_KEY, model or "claude-sonnet-4-20250514"

    if provider and api_key:
        prompt = (
            f"Analyze this SEO keyword:\n\n"
            f"Keyword: {keyword.keyword}\n"
            f"Website: {website or 'N/A'}\n"
            f"Industry: {industry or 'N/A'}\n\n"
            f"Respond with ONLY valid JSON:\n"
            f'{{"search_volume": 5000, "difficulty": 65, "suggested_rank": 15, '
            f'"content_ideas": ["idea 1", "idea 2", "idea 3"], '
            f'"related_keywords": ["kw1", "kw2", "kw3"]}}\n\n'
            f"Estimate realistic search volume (monthly), difficulty (0-100), achievable rank. "
            f"Provide 3 content ideas and 3 related keywords."
        )

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{settings.AGNO_RUNTIME_URL}/execute",
                    json={
                        "provider": provider,
                        "api_key": api_key,
                        "model": model or "gpt-4o",
                        "system_prompt": "You are an SEO keyword analyst. Respond with valid JSON only.",
                        "messages": [{"role": "user", "content": prompt}],
                        "tools": [],
                        "temperature": 0.5,
                        "max_tokens": 1024,
                    },
                )
                if resp.status_code == 200:
                    import json as json_module
                    ai_text = resp.json().get("response", "")
                    clean = ai_text.strip()
                    if clean.startswith("```"):
                        clean = clean.split("\n", 1)[1] if "\n" in clean else clean[3:]
                        clean = clean.rsplit("```", 1)[0]
                    try:
                        parsed = json_module.loads(clean)
                        keyword.search_volume = parsed.get("search_volume", keyword.search_volume)
                        keyword.difficulty = parsed.get("difficulty", keyword.difficulty)
                        keyword.current_rank = parsed.get("suggested_rank", keyword.current_rank)
                    except json_module.JSONDecodeError:
                        pass
        except Exception:
            pass

    await db.flush()
    return keyword


@router.get("/audits/{audit_id}", response_model=SEOAuditResponse)
async def get_audit(audit_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(SEOAudit).where(SEOAudit.id == audit_id, SEOAudit.tenant_id == user.tenant_id)
    )
    audit = result.scalar_one_or_none()
    if not audit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audit not found")
    return audit
