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
    audit = SEOAudit(
        tenant_id=user.tenant_id,
        audit_type=data.audit_type,
        score=data.score,
        issues=data.issues or [],
        recommendations=data.recommendations or [],
    )
    db.add(audit)
    await db.flush()
    return audit


@router.get("/audits/{audit_id}", response_model=SEOAuditResponse)
async def get_audit(audit_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(SEOAudit).where(SEOAudit.id == audit_id, SEOAudit.tenant_id == user.tenant_id)
    )
    audit = result.scalar_one_or_none()
    if not audit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audit not found")
    return audit
