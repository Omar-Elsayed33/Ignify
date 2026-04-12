"""Celery tasks for publishing scheduled social posts."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from uuid import UUID

import httpx
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.db.models import SocialAccount, SocialPlatform, SocialPost, SocialPostStatus
from app.worker import celery_app


def _task_session_maker():
    """Fresh engine per Celery task — avoids asyncpg 'another operation in progress'
    caused by pool connections being shared across Celery's forked workers."""
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool, echo=False)
    return engine, async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def _with_session(fn):
    engine, maker = _task_session_maker()
    try:
        async with maker() as db:
            return await fn(db)
    finally:
        await engine.dispose()


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=20))
async def _publish_to_facebook(page_id: str, token: str, caption: str, media_urls: list[str]) -> str:
    async with httpx.AsyncClient(timeout=30.0) as client:
        if media_urls:
            resp = await client.post(
                f"https://graph.facebook.com/v19.0/{page_id}/photos",
                data={"url": media_urls[0], "caption": caption, "access_token": token},
            )
        else:
            resp = await client.post(
                f"https://graph.facebook.com/v19.0/{page_id}/feed",
                data={"message": caption, "access_token": token},
            )
        resp.raise_for_status()
        data = resp.json()
        return str(data.get("id") or data.get("post_id") or "")


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=20))
async def _publish_to_instagram(ig_user_id: str, token: str, caption: str, media_urls: list[str]) -> str:
    if not media_urls:
        raise ValueError("Instagram posts require at least one media URL")
    async with httpx.AsyncClient(timeout=30.0) as client:
        container = await client.post(
            f"https://graph.facebook.com/v19.0/{ig_user_id}/media",
            data={"image_url": media_urls[0], "caption": caption, "access_token": token},
        )
        container.raise_for_status()
        creation_id = container.json().get("id")
        publish = await client.post(
            f"https://graph.facebook.com/v19.0/{ig_user_id}/media_publish",
            data={"creation_id": creation_id, "access_token": token},
        )
        publish.raise_for_status()
        return str(publish.json().get("id") or "")


async def _publish_async(post_id: str) -> dict:
    engine, maker = _task_session_maker()
    try:
        async with maker() as db:
            result = await db.execute(
                select(SocialPost).where(SocialPost.id == UUID(post_id))
            )
            post = result.scalar_one_or_none()
            if not post:
                return {"status": "error", "message": "Post not found"}
            if post.status != SocialPostStatus.scheduled:
                return {"status": "skipped", "reason": f"status={post.status}"}

            acct_row = await db.execute(
                select(SocialAccount).where(SocialAccount.id == post.social_account_id)
            )
            acct = acct_row.scalar_one_or_none()
            if not acct or not acct.access_token_encrypted:
                post.status = SocialPostStatus.failed
                await db.commit()
                return {"status": "error", "message": "Missing account or token"}

            try:
                platform = acct.platform
                if platform == SocialPlatform.facebook:
                    external_id = await _publish_to_facebook(
                        acct.account_id,
                        acct.access_token_encrypted,
                        post.content,
                        list(post.media_urls or []),
                    )
                elif platform == SocialPlatform.instagram:
                    external_id = await _publish_to_instagram(
                        acct.account_id,
                        acct.access_token_encrypted,
                        post.content,
                        list(post.media_urls or []),
                    )
                else:
                    post.status = SocialPostStatus.failed
                    await db.commit()
                    return {"status": "error", "message": f"Unsupported platform: {platform}"}

                post.status = SocialPostStatus.published
                post.external_post_id = external_id
                post.published_at = datetime.now(timezone.utc)
                await db.commit()
                return {"status": "published", "external_id": external_id}
            except Exception as exc:  # noqa: BLE001
                post.status = SocialPostStatus.failed
                await db.commit()
                return {"status": "failed", "error": str(exc)}
    finally:
        await engine.dispose()


@celery_app.task(bind=True, name="ignify.publish_scheduled_post")
def publish_scheduled_post(self, post_id: str) -> dict:
    return asyncio.run(_publish_async(post_id))


async def _scan_due() -> dict:
    now = datetime.now(timezone.utc)
    engine, maker = _task_session_maker()
    try:
        async with maker() as db:
            rows = await db.execute(
                select(SocialPost).where(
                    and_(
                        SocialPost.status == SocialPostStatus.scheduled,
                        SocialPost.scheduled_at <= now,
                    )
                )
            )
            posts = rows.scalars().all()
            post_ids = [str(p.id) for p in posts]
    finally:
        await engine.dispose()

    for pid in post_ids:
        publish_scheduled_post.delay(pid)
    return {"enqueued": len(post_ids)}


@celery_app.task(bind=True, name="ignify.scan_due_posts")
def scan_due_posts(self) -> dict:
    return asyncio.run(_scan_due())
