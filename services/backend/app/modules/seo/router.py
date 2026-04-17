import uuid

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.db.models import SEOAudit, SEOKeyword, SEORanking
from app.dependencies import CurrentUser, DbSession
from app.modules.seo.schemas import (
    SEOAuditCreate,
    SEOAuditResponse,
    SEOKeywordBulkCreate,
    SEOKeywordCreate,
    SEOKeywordResponse,
    SEOKeywordUpdate,
    SEORankingResponse,
    SEOAuditUrlRequest,
    SEOSuggestRequest,
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
        cpc=data.cpc,
        intent=data.intent,
        current_rank=data.current_rank,
        target_url=data.target_url,
        location=data.location,
        language=data.language,
    )
    db.add(keyword)
    await db.flush()
    return keyword


@router.post("/keywords/bulk", response_model=list[SEOKeywordResponse], status_code=status.HTTP_201_CREATED)
async def create_keywords_bulk(data: SEOKeywordBulkCreate, user: CurrentUser, db: DbSession):
    """Bulk-paste keywords (newline or comma separated list, normalised by caller)."""
    created: list[SEOKeyword] = []
    for kw in data.keywords:
        kw_clean = (kw or "").strip()
        if not kw_clean:
            continue
        row = SEOKeyword(
            tenant_id=user.tenant_id,
            keyword=kw_clean,
            target_url=data.target_url,
            location=data.location,
            language=data.language,
        )
        db.add(row)
        created.append(row)
    await db.flush()
    return created


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


# ── Live providers: real SERP rank tracking + on-page audit + suggestions ──


@router.post("/keywords/{keyword_id}/track", response_model=SEORankingResponse, status_code=status.HTTP_201_CREATED)
async def track_keyword_ranking(keyword_id: uuid.UUID, user: CurrentUser, db: DbSession):
    """Run a live SERP check for the keyword and store a SEORanking row."""
    from datetime import date as _date

    from app.core.seo import find_ranking, keyword_metrics

    result = await db.execute(
        select(SEOKeyword).where(SEOKeyword.id == keyword_id, SEOKeyword.tenant_id == user.tenant_id)
    )
    keyword = result.scalar_one_or_none()
    if not keyword:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Keyword not found")

    target_url = keyword.target_url or ""
    domain = target_url.replace("https://", "").replace("http://", "").split("/")[0]
    hl = keyword.language or "ar"
    loc = keyword.location or "Egypt"

    rank_info = await find_ranking(keyword.keyword, domain, location=loc, hl=hl)
    position = rank_info.get("position")

    # Also try to enrich metrics in the background (non-fatal)
    if keyword.search_volume is None:
        metrics = await keyword_metrics(keyword.keyword)
        if metrics.get("search_volume") is not None:
            keyword.search_volume = metrics.get("search_volume")
        if metrics.get("cpc") is not None:
            keyword.cpc = float(metrics.get("cpc") or 0.0) or None

    ranking = SEORanking(
        keyword_id=keyword.id,
        rank=position or 0,
        url=rank_info.get("url"),
        title=rank_info.get("title"),
        serp_features=rank_info.get("serp_features") or [],
        date=_date.today(),
    )
    db.add(ranking)
    if position is not None:
        keyword.current_rank = position
    await db.flush()
    return ranking


@router.post("/audit", response_model=SEOAuditResponse, status_code=status.HTTP_201_CREATED)
async def audit_url_endpoint(data: SEOAuditUrlRequest, user: CurrentUser, db: DbSession):
    """Run an on-page audit for a URL + orchestrate SEOAgent for recommendations."""
    from app.agents.registry import get_agent
    from app.core.seo_audit import audit_url as _audit

    raw = await _audit(data.url)

    recommendations: list[dict] = []
    content_suggestions: dict = {}
    linking_strategy: list[dict] = []
    rankings: list[dict] = []

    try:
        agent = get_agent("seo", tenant_id=str(user.tenant_id))
        agent_out = await agent.run(
            {
                "tenant_id": str(user.tenant_id),
                "url": data.url,
                "language": data.language or "ar",
                "target_keywords": data.target_keywords or [],
                "audit_result": raw,
            },
            thread_id=f"seo-audit-{uuid.uuid4()}",
        )
        recommendations = agent_out.get("recommendations") or []
        content_suggestions = agent_out.get("content_suggestions") or {}
        linking_strategy = agent_out.get("linking_strategy") or []
        rankings = agent_out.get("rankings") or []
    except Exception as e:  # noqa: BLE001
        recommendations = [
            {"priority": "info", "category": "system", "title": "Agent unavailable", "description": str(e)}
        ]

    # Build issues list from raw audit
    issues = [
        {"severity": "medium", "category": "on-page", "title": iss, "description": iss}
        for iss in (raw.get("issues") or [])
    ]

    # Stash suggestions and linking into recommendations as metadata items too
    if content_suggestions:
        recommendations.append(
            {
                "priority": "info",
                "category": "content",
                "title": "Content Suggestions",
                "description": content_suggestions,
            }
        )
    if linking_strategy:
        recommendations.append(
            {
                "priority": "info",
                "category": "linking",
                "title": "Internal Linking Strategy",
                "description": linking_strategy,
            }
        )
    if rankings:
        recommendations.append(
            {
                "priority": "info",
                "category": "rankings",
                "title": "Live Rankings",
                "description": rankings,
            }
        )

    audit = SEOAudit(
        tenant_id=user.tenant_id,
        audit_type="on-page",
        score=raw.get("score"),
        issues=issues,
        recommendations=recommendations,
    )
    db.add(audit)
    await db.flush()
    return audit


@router.post("/suggest")
async def suggest_content(data: SEOSuggestRequest, user: CurrentUser):
    """Produce title/meta/H1/outline suggestions for a topic."""
    from app.agents.seo.subagents.content_suggester import ContentSuggester

    sub = ContentSuggester(tenant_id=str(user.tenant_id))
    out = await sub.execute(
        {
            "tenant_id": str(user.tenant_id),
            "language": data.language or "ar",
            "target_keywords": data.keywords or [data.topic],
            "audit_result": {"title": data.topic},
        }
    )
    return out.get("content_suggestions") or {}


# ─── Deep audit (multi-page + LLM recommendations) ──────────────────────────

@router.post("/audit/deep")
async def deep_audit_endpoint(data: SEOAuditUrlRequest, user: CurrentUser, db: DbSession):
    """Full site audit: homepage + internal pages + robots/sitemap + LLM recommendations."""
    from app.core.seo_audit_deep import deep_audit

    result = await deep_audit(data.url, language=data.language or "ar")

    # Persist as an audit row (type = 'deep')
    audit = SEOAudit(
        tenant_id=user.tenant_id,
        audit_type="deep",
        score=result.get("score"),
        issues=result.get("site_issues") or [],
        recommendations=result.get("recommendations") or [],
    )
    db.add(audit)
    await db.flush()
    return {**result, "audit_id": str(audit.id)}


# ─── Integrations (Google Search Console + Google Analytics) ────────────────

from app.modules.seo import integrations as gi_mod  # noqa: E402
from fastapi.responses import RedirectResponse  # noqa: E402
from app.db.database import async_session  # noqa: E402


@router.get("/integrations")
async def integrations_status(user: CurrentUser, db: DbSession):
    """Return connection status for Search Console + Analytics."""
    return await gi_mod.status_snapshot(db, user.tenant_id)


@router.get("/integrations/{service}/connect")
async def integrations_connect(service: str, user: CurrentUser):
    """Return the Google OAuth URL to redirect the user to."""
    if service not in gi_mod.VALID_SERVICES:
        raise HTTPException(status_code=400, detail="Unknown service")
    if not gi_mod.oauth_configured():
        raise HTTPException(
            status_code=400,
            detail="Google OAuth not configured (missing GOOGLE_OAUTH_CLIENT_ID/SECRET env vars).",
        )
    try:
        url = gi_mod.build_auth_url(user.tenant_id, service)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"url": url}


@router.get("/integrations/oauth/google/callback")
async def integrations_oauth_callback(code: str, state: str):
    """Google redirects here — no auth header; we resolve tenant via state token."""
    from app.core.config import settings as app_settings

    async with async_session() as db:
        try:
            _tenant_id, _service = await gi_mod.exchange_code(db, code, state)
            await db.commit()
        except Exception as e:  # noqa: BLE001
            await db.rollback()
            raise HTTPException(status_code=400, detail=f"OAuth callback failed: {e}") from e
    target = app_settings.GOOGLE_OAUTH_POST_REDIRECT
    sep = "&" if "?" in target else "?"
    return RedirectResponse(url=f"{target}{sep}connected={_service}")


@router.delete("/integrations/{service}", status_code=status.HTTP_204_NO_CONTENT)
async def integrations_disconnect(service: str, user: CurrentUser, db: DbSession):
    if service not in gi_mod.VALID_SERVICES:
        raise HTTPException(status_code=400, detail="Unknown service")
    await gi_mod.disconnect(db, user.tenant_id, service)


@router.get("/integrations/search-console/sites")
async def integrations_sc_sites(user: CurrentUser, db: DbSession):
    try:
        sites = await gi_mod.sc_list_sites(db, user.tenant_id)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))
    return {"sites": sites}


class _SetSiteBody(BaseModel):
    site_url: str


@router.post("/integrations/search-console/site")
async def integrations_sc_set_site(data: _SetSiteBody, user: CurrentUser, db: DbSession):
    await gi_mod.sc_set_site(db, user.tenant_id, data.site_url)
    return {"ok": True, "site_url": data.site_url}


@router.post("/integrations/search-console/sync")
async def integrations_sc_sync(user: CurrentUser, db: DbSession, days: int = 28):
    try:
        data = await gi_mod.sc_sync(db, user.tenant_id, days=days)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"GSC sync failed: {e}")
    return data


@router.get("/integrations/analytics/properties")
async def integrations_ga_properties(user: CurrentUser, db: DbSession):
    try:
        props = await gi_mod.ga_list_properties(db, user.tenant_id)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))
    return {"properties": props}


class _SetPropertyBody(BaseModel):
    property_id: str


@router.post("/integrations/analytics/property")
async def integrations_ga_set_property(
    data: _SetPropertyBody, user: CurrentUser, db: DbSession
):
    await gi_mod.ga_set_property(db, user.tenant_id, data.property_id)
    return {"ok": True, "property_id": data.property_id}


@router.post("/integrations/analytics/sync")
async def integrations_ga_sync(user: CurrentUser, db: DbSession, days: int = 28):
    try:
        data = await gi_mod.ga_sync(db, user.tenant_id, days=days)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"GA sync failed: {e}")
    return data
