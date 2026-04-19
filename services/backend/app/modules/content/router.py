import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.db.database import get_db
from app.db.models import (
    ContentActivity,
    ContentCalendar,
    ContentPost,
    ContentStatus,
    CreativeAsset,
    UserRole,
)
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
    return ContentPostResponse(
        id=post.id,
        tenant_id=post.tenant_id,
        title=post.title,
        body=post.body,
        post_type=post.post_type,
        platform=post.platform,
        status=post.status,
        scheduled_at=post.scheduled_at,
        published_at=post.published_at,
        metadata=post.metadata_,
        created_at=post.created_at,
    )


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


# ─── Approval Workflow ───────────────────────────────────────────────


class _RejectBody(BaseModel):
    reason: Optional[str] = None


class _NoteBody(BaseModel):
    note: Optional[str] = None


class ContentActivityResponse(BaseModel):
    id: uuid.UUID
    content_post_id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    action: str
    note: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


async def _load_post(db, post_id: uuid.UUID, tenant_id: uuid.UUID) -> ContentPost:
    result = await db.execute(
        select(ContentPost).where(
            ContentPost.id == post_id, ContentPost.tenant_id == tenant_id
        )
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


async def _log_activity(
    db,
    *,
    tenant_id: uuid.UUID,
    post_id: uuid.UUID,
    user_id: uuid.UUID,
    action: str,
    note: Optional[str] = None,
) -> ContentActivity:
    activity = ContentActivity(
        tenant_id=tenant_id,
        content_post_id=post_id,
        user_id=user_id,
        action=action,
        note=note,
    )
    db.add(activity)
    await db.flush()
    return activity


def _require_editor(user) -> None:
    if user.role not in (UserRole.owner, UserRole.admin, UserRole.editor, UserRole.superadmin):
        raise HTTPException(status_code=403, detail="Editor or admin role required")


@router.post("/posts/{post_id}/submit-review", response_model=ContentPostResponse)
async def submit_review(post_id: uuid.UUID, user: CurrentUser, db: DbSession):
    post = await _load_post(db, post_id, user.tenant_id)
    post.status = ContentStatus.review
    await _log_activity(
        db, tenant_id=user.tenant_id, post_id=post.id, user_id=user.id,
        action="submit_review",
    )
    await db.commit()
    await db.refresh(post)
    return post


@router.post("/posts/{post_id}/approve", response_model=ContentPostResponse)
async def approve_post(post_id: uuid.UUID, user: CurrentUser, db: DbSession):
    _require_editor(user)
    post = await _load_post(db, post_id, user.tenant_id)
    post.status = ContentStatus.approved
    await _log_activity(
        db, tenant_id=user.tenant_id, post_id=post.id, user_id=user.id,
        action="approve",
    )
    await db.commit()
    await db.refresh(post)
    return post


@router.post("/posts/{post_id}/reject", response_model=ContentPostResponse)
async def reject_post(
    post_id: uuid.UUID, data: _RejectBody, user: CurrentUser, db: DbSession
):
    _require_editor(user)
    post = await _load_post(db, post_id, user.tenant_id)
    post.status = ContentStatus.rejected
    await _log_activity(
        db, tenant_id=user.tenant_id, post_id=post.id, user_id=user.id,
        action="reject", note=data.reason,
    )
    await db.commit()
    await db.refresh(post)
    return post


@router.post("/posts/{post_id}/publish-now", response_model=ContentPostResponse)
async def publish_now(post_id: uuid.UUID, user: CurrentUser, db: DbSession):
    post = await _load_post(db, post_id, user.tenant_id)
    post.status = ContentStatus.published
    post.published_at = datetime.now(timezone.utc)

    social_post_id = None
    if post.metadata_ and isinstance(post.metadata_, dict):
        social_post_id = post.metadata_.get("social_post_id")

    note = None
    if social_post_id:
        # Trigger social publish if a linked SocialPost exists
        try:
            from app.modules.social_scheduler.service import publish_post as _publish_social
            await _publish_social(db, user.tenant_id, uuid.UUID(str(social_post_id)))
            note = f"social_post_id={social_post_id}"
        except Exception as e:  # noqa: BLE001
            note = f"social publish failed: {str(e)[:200]}"

    await _log_activity(
        db, tenant_id=user.tenant_id, post_id=post.id, user_id=user.id,
        action="publish", note=note,
    )
    await db.commit()
    await db.refresh(post)
    return post


@router.get("/posts/{post_id}/activity", response_model=list[ContentActivityResponse])
async def list_activity(post_id: uuid.UUID, user: CurrentUser, db: DbSession):
    await _load_post(db, post_id, user.tenant_id)
    result = await db.execute(
        select(ContentActivity)
        .where(ContentActivity.content_post_id == post_id)
        .order_by(ContentActivity.created_at.asc())
    )
    return list(result.scalars().all())


@router.post(
    "/posts/{post_id}/comment",
    response_model=ContentActivityResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_comment(
    post_id: uuid.UUID, data: _NoteBody, user: CurrentUser, db: DbSession
):
    await _load_post(db, post_id, user.tenant_id)
    activity = await _log_activity(
        db, tenant_id=user.tenant_id, post_id=post_id, user_id=user.id,
        action="comment", note=data.note,
    )
    await db.commit()
    await db.refresh(activity)
    return activity


class _AttachCreativeBody(BaseModel):
    creative_id: uuid.UUID


@router.post("/{content_id}/attach-creative", response_model=ContentPostResponse)
async def attach_creative(
    content_id: uuid.UUID,
    body: _AttachCreativeBody,
    user: CurrentUser,
    db: DbSession,
):
    """Attach a creative asset to a content post.

    Appends `creative_id` to `metadata.creative_ids` (deduplicated).
    """
    post = await _load_post(db, content_id, user.tenant_id)
    asset = (
        await db.execute(
            select(CreativeAsset).where(
                CreativeAsset.id == body.creative_id,
                CreativeAsset.tenant_id == user.tenant_id,
            )
        )
    ).scalar_one_or_none()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Creative not found"
        )

    meta = dict(post.metadata_ or {})
    creative_ids = list(meta.get("creative_ids") or [])
    cid = str(body.creative_id)
    if cid not in creative_ids:
        creative_ids.append(cid)
    meta["creative_ids"] = creative_ids
    post.metadata_ = meta
    await db.flush()
    await db.commit()
    await db.refresh(post)
    return post


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
