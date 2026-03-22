import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.db.models import SocialAccount, SocialMetric, SocialPost
from app.dependencies import CurrentUser, DbSession
from app.modules.social.schemas import (
    SocialAccountCreate,
    SocialAccountResponse,
    SocialMetricResponse,
    SocialPostCreate,
    SocialPostResponse,
    SocialPostUpdate,
)

router = APIRouter(prefix="/social", tags=["social"])


# ── Social Accounts ──


@router.get("/accounts", response_model=list[SocialAccountResponse])
async def list_social_accounts(user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(SocialAccount).where(SocialAccount.tenant_id == user.tenant_id).order_by(SocialAccount.created_at.desc())
    )
    return result.scalars().all()


@router.post("/accounts", response_model=SocialAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_social_account(data: SocialAccountCreate, user: CurrentUser, db: DbSession):
    account = SocialAccount(
        tenant_id=user.tenant_id,
        platform=data.platform,
        account_id=data.account_id,
        name=data.name,
        access_token_encrypted=data.access_token_encrypted,
    )
    db.add(account)
    await db.flush()
    return account


@router.get("/accounts/{account_id}", response_model=SocialAccountResponse)
async def get_social_account(account_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(SocialAccount).where(SocialAccount.id == account_id, SocialAccount.tenant_id == user.tenant_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Social account not found")
    return account


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_social_account(account_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(SocialAccount).where(SocialAccount.id == account_id, SocialAccount.tenant_id == user.tenant_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Social account not found")
    await db.delete(account)
    await db.flush()


# ── Posts ──


@router.get("/posts", response_model=list[SocialPostResponse])
async def list_social_posts(user: CurrentUser, db: DbSession, account_id: uuid.UUID | None = None, skip: int = 0, limit: int = 50):
    query = select(SocialPost).where(SocialPost.tenant_id == user.tenant_id)
    if account_id:
        query = query.where(SocialPost.social_account_id == account_id)
    query = query.order_by(SocialPost.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/posts", response_model=SocialPostResponse, status_code=status.HTTP_201_CREATED)
async def create_social_post(data: SocialPostCreate, user: CurrentUser, db: DbSession):
    acc_result = await db.execute(
        select(SocialAccount).where(SocialAccount.id == data.social_account_id, SocialAccount.tenant_id == user.tenant_id)
    )
    if not acc_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Social account not found")

    post = SocialPost(
        tenant_id=user.tenant_id,
        social_account_id=data.social_account_id,
        content=data.content,
        media_urls=data.media_urls or [],
        status=data.status,
        scheduled_at=data.scheduled_at,
    )
    db.add(post)
    await db.flush()
    return post


@router.get("/posts/{post_id}", response_model=SocialPostResponse)
async def get_social_post(post_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(SocialPost).where(SocialPost.id == post_id, SocialPost.tenant_id == user.tenant_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Social post not found")
    return post


@router.put("/posts/{post_id}", response_model=SocialPostResponse)
async def update_social_post(post_id: uuid.UUID, data: SocialPostUpdate, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(SocialPost).where(SocialPost.id == post_id, SocialPost.tenant_id == user.tenant_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Social post not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(post, field, value)
    await db.flush()
    return post


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_social_post(post_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(SocialPost).where(SocialPost.id == post_id, SocialPost.tenant_id == user.tenant_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Social post not found")
    await db.delete(post)
    await db.flush()


# ── Metrics ──


@router.get("/posts/{post_id}/metrics", response_model=list[SocialMetricResponse])
async def get_post_metrics(post_id: uuid.UUID, user: CurrentUser, db: DbSession):
    post_result = await db.execute(
        select(SocialPost).where(SocialPost.id == post_id, SocialPost.tenant_id == user.tenant_id)
    )
    if not post_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Social post not found")
    result = await db.execute(
        select(SocialMetric).where(SocialMetric.social_post_id == post_id).order_by(SocialMetric.recorded_at.desc())
    )
    return result.scalars().all()
