"""Celery tasks for notifications (welcome, onboarding drip, weekly reports)."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import and_, func, select

from app.db.database import async_session
from app.db.models import Lead, MarketingPlan, SocialMetric, SocialPost, Tenant, User
from app.modules.notifications.service import send_to_user
from app.worker import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="ignify.send_notification_email")
def send_notification_email(self, user_id: str, template_name: str, context: dict[str, Any] | None = None) -> dict:
    """Entry point for code that wants to enqueue a notification."""
    ctx = context or {}

    async def _run() -> bool:
        return await send_to_user(UUID(user_id), template_name, ctx)

    ok = asyncio.run(_run())
    return {"status": "sent" if ok else "skipped", "user_id": user_id, "template": template_name}


@celery_app.task(bind=True, name="ignify.scan_onboarding_emails")
def scan_onboarding_emails(self) -> dict:
    """Daily: find users at D+1, D+3, D+7 and send the appropriate onboarding email."""

    async def _run() -> dict[str, int]:
        sent = {"day_1": 0, "day_3": 0, "day_7": 0}
        now = datetime.now(timezone.utc)
        async with async_session() as db:
            users_q = await db.execute(
                select(User).where(and_(User.is_active.is_(True), User.tenant_id.is_not(None)))
            )
            users = users_q.scalars().all()

            for u in users:
                if not u.created_at:
                    continue
                created = u.created_at
                if created.tzinfo is None:
                    created = created.replace(tzinfo=timezone.utc)
                age = now - created

                # D+1 — onboarding not complete
                if timedelta(days=1) <= age < timedelta(days=2):
                    tenant_res = await db.execute(select(Tenant).where(Tenant.id == u.tenant_id))
                    tenant = tenant_res.scalar_one_or_none()
                    completed = bool((tenant.config or {}).get("onboarding_completed")) if tenant else False
                    if not completed:
                        send_notification_email.delay(str(u.id), "onboarding_day_1", {})
                        sent["day_1"] += 1

                # D+3 — plan not generated
                elif timedelta(days=3) <= age < timedelta(days=4):
                    plan_res = await db.execute(
                        select(func.count()).select_from(MarketingPlan).where(MarketingPlan.tenant_id == u.tenant_id)
                    )
                    has_plan = (plan_res.scalar() or 0) > 0
                    if not has_plan:
                        send_notification_email.delay(str(u.id), "onboarding_day_3", {})
                        sent["day_3"] += 1

                # D+7 — tips
                elif timedelta(days=7) <= age < timedelta(days=8):
                    send_notification_email.delay(str(u.id), "onboarding_day_7", {})
                    sent["day_7"] += 1
        return sent

    return asyncio.run(_run())


@celery_app.task(bind=True, name="ignify.scan_weekly_reports")
def scan_weekly_reports(self) -> dict:
    """Weekly (Mondays 09:00 UTC): send each active tenant owner a snapshot."""

    async def _run() -> int:
        count = 0
        now = datetime.now(timezone.utc)
        week_ago = now - timedelta(days=7)
        async with async_session() as db:
            owners_q = await db.execute(
                select(User).where(and_(User.role == "owner", User.is_active.is_(True)))
            )
            for u in owners_q.scalars().all():
                if not u.tenant_id:
                    continue
                # Aggregate last-7d reach / engagement / new leads / published posts
                reach_q = await db.execute(
                    select(func.coalesce(func.sum(SocialMetric.reach), 0))
                    .join(SocialPost, SocialPost.id == SocialMetric.social_post_id)
                    .where(and_(SocialPost.tenant_id == u.tenant_id, SocialMetric.recorded_at >= week_ago))
                )
                eng_q = await db.execute(
                    select(func.coalesce(func.avg(SocialMetric.engagement_rate), 0.0))
                    .join(SocialPost, SocialPost.id == SocialMetric.social_post_id)
                    .where(and_(SocialPost.tenant_id == u.tenant_id, SocialMetric.recorded_at >= week_ago))
                )
                leads_q = await db.execute(
                    select(func.count()).select_from(Lead).where(
                        and_(Lead.tenant_id == u.tenant_id, Lead.created_at >= week_ago)
                    )
                )
                posts_q = await db.execute(
                    select(func.count()).select_from(SocialPost).where(
                        and_(SocialPost.tenant_id == u.tenant_id, SocialPost.published_at >= week_ago)
                    )
                )
                stats = {
                    "reach": int(reach_q.scalar() or 0),
                    "engagement_rate": round(float(eng_q.scalar() or 0), 2),
                    "new_leads": int(leads_q.scalar() or 0),
                    "posts_published": int(posts_q.scalar() or 0),
                }
                send_notification_email.delay(str(u.id), "weekly_report", {"stats": stats})
                count += 1
        return count

    sent = asyncio.run(_run())
    return {"status": "queued", "count": sent}
