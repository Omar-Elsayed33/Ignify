"""Celery tasks for AI usage sync and monthly limit reset."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.db.database import async_session
from app.db.models import TenantOpenRouterConfig
from app.worker import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="ignify.sync_all_tenants_ai_usage")
def sync_all_tenants_ai_usage(self) -> dict:
    """Hourly: pull latest usage from OpenRouter for all active tenants."""

    async def _run() -> dict:
        from app.core.openrouter_provisioning import get_key_usage

        synced = 0
        errors = 0
        async with async_session() as db:
            result = await db.execute(
                select(TenantOpenRouterConfig).where(TenantOpenRouterConfig.openrouter_key_id.isnot(None))
            )
            configs = result.scalars().all()

            for config in configs:
                try:
                    data = await get_key_usage(config.openrouter_key_id)
                    if data:
                        config.usage_usd = data["usage"]
                        config.usage_synced_at = datetime.now(timezone.utc)
                        synced += 1
                except Exception as exc:
                    logger.warning("AI usage sync failed", extra={"key_id": config.openrouter_key_id, "error": str(exc)})
                    errors += 1

            await db.commit()

        return {"synced": synced, "errors": errors}

    return asyncio.run(_run())


@celery_app.task(bind=True, name="ignify.reset_monthly_ai_limits")
def reset_monthly_ai_limits(self) -> dict:
    """Monthly (1st of month): reset usage counters and refresh limits on OpenRouter."""

    async def _run() -> dict:
        from app.core.openrouter_provisioning import update_key_limit
        from app.modules.ai_usage.service import _next_reset

        reset = 0
        errors = 0
        now = datetime.now(timezone.utc)

        async with async_session() as db:
            result = await db.execute(
                select(TenantOpenRouterConfig).where(
                    TenantOpenRouterConfig.openrouter_key_id.isnot(None),
                    TenantOpenRouterConfig.reset_at <= now,
                )
            )
            configs = result.scalars().all()

            for config in configs:
                try:
                    limit = float(config.monthly_limit_usd)
                    ok = await update_key_limit(config.openrouter_key_id, limit)
                    if ok:
                        config.usage_usd = 0.0
                        config.reset_at = _next_reset()
                        config.usage_synced_at = now
                        reset += 1
                except Exception as exc:
                    logger.warning("AI limit reset failed", extra={"key_id": config.openrouter_key_id, "error": str(exc)})
                    errors += 1

            await db.commit()

        return {"reset": reset, "errors": errors}

    return asyncio.run(_run())


@celery_app.task(bind=True, name="ignify.notify_high_ai_usage")
def notify_high_ai_usage(self) -> dict:
    """Daily: alert tenants who have used >= 90% of their monthly AI credit."""

    async def _run() -> dict:
        notified = 0
        async with async_session() as db:
            result = await db.execute(
                select(TenantOpenRouterConfig).where(TenantOpenRouterConfig.monthly_limit_usd > 0)
            )
            configs = result.scalars().all()

            for config in configs:
                limit = float(config.monthly_limit_usd)
                usage = float(config.usage_usd)
                pct = (usage / limit) * 100 if limit > 0 else 0
                if pct >= 90:
                    try:
                        from sqlalchemy import select as sel
                        from app.db.models import User, UserRole
                        users_r = await db.execute(
                            sel(User).where(
                                User.tenant_id == config.tenant_id,
                                User.role.in_([UserRole.owner, UserRole.admin]),
                                User.is_active == True,
                            )
                        )
                        for user in users_r.scalars().all():
                            from app.modules.notifications.tasks import send_notification_email
                            send_notification_email.delay(
                                str(user.id),
                                "ai_usage_high",
                                {"usage_pct": round(pct, 1), "remaining_usd": round(limit - usage, 2)},
                            )
                        notified += 1
                    except Exception:
                        pass

        return {"notified": notified}

    return asyncio.run(_run())
