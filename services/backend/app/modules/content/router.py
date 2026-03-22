import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import ContentCalendar, ContentPost
from app.dependencies import CurrentUser, DbSession
from app.modules.content.schemas import (
    CalendarEntryCreate,
    CalendarEntryResponse,
    ContentGenerateRequest,
    ContentGenerateResponse,
    ContentPostCreate,
    ContentPostResponse,
    ContentPostUpdate,
)
from app.modules.content.service import generate_content

router = APIRouter(prefix="/content", tags=["content"])


@router.get("/posts", response_model=list[ContentPostResponse])
async def list_posts(user: CurrentUser, db: DbSession, skip: int = 0, limit: int = 50):
    result = await db.execute(
        select(ContentPost)
        .where(ContentPost.tenant_id == user.tenant_id)
        .order_by(ContentPost.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/posts", response_model=ContentPostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(data: ContentPostCreate, user: CurrentUser, db: DbSession):
    post = ContentPost(
        tenant_id=user.tenant_id,
        title=data.title,
        body=data.body,
        post_type=data.post_type,
        platform=data.platform,
        status=data.status,
        scheduled_at=data.scheduled_at,
        metadata_=data.metadata or {},
    )
    db.add(post)
    await db.flush()
    return post


@router.get("/posts/{post_id}", response_model=ContentPostResponse)
async def get_post(post_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(ContentPost).where(ContentPost.id == post_id, ContentPost.tenant_id == user.tenant_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return post


@router.put("/posts/{post_id}", response_model=ContentPostResponse)
async def update_post(post_id: uuid.UUID, data: ContentPostUpdate, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(ContentPost).where(ContentPost.id == post_id, ContentPost.tenant_id == user.tenant_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "metadata":
            setattr(post, "metadata_", value)
        else:
            setattr(post, field, value)
    await db.flush()
    return post


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(post_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(ContentPost).where(ContentPost.id == post_id, ContentPost.tenant_id == user.tenant_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    await db.delete(post)
    await db.flush()


@router.post("/generate", response_model=ContentGenerateResponse)
async def generate_content_endpoint(data: ContentGenerateRequest, user: CurrentUser, db: DbSession):
    result = await generate_content(
        db=db,
        tenant_id=user.tenant_id,
        topic=data.topic,
        post_type=data.post_type.value,
        platform=data.platform,
        tone=data.tone,
        keywords=data.keywords,
        max_length=data.max_length,
    )
    return ContentGenerateResponse(**result)


# Calendar endpoints

@router.get("/calendar", response_model=list[CalendarEntryResponse])
async def list_calendar(user: CurrentUser, db: DbSession, skip: int = 0, limit: int = 100):
    result = await db.execute(
        select(ContentCalendar)
        .where(ContentCalendar.tenant_id == user.tenant_id)
        .order_by(ContentCalendar.scheduled_date.asc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/calendar", response_model=CalendarEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_calendar_entry(data: CalendarEntryCreate, user: CurrentUser, db: DbSession):
    entry = ContentCalendar(
        tenant_id=user.tenant_id,
        content_post_id=data.content_post_id,
        scheduled_date=data.scheduled_date,
        platform=data.platform,
    )
    db.add(entry)
    await db.flush()
    return entry
