"""Async service layer for sending notification emails."""
from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import select

from app.core.email import send_email
from app.db.database import async_session
from app.db.models import User
from app.modules.notifications.templates import render

logger = logging.getLogger(__name__)


async def send_to_user(user_id: uuid.UUID, template_name: str, context: dict[str, Any]) -> bool:
    """Render the template in the user's preferred language and send."""
    async with async_session() as db:
        res = await db.execute(select(User).where(User.id == user_id))
        user = res.scalar_one_or_none()
        if not user or not user.is_active:
            logger.warning("notification skipped — user %s not found/inactive", user_id)
            return False

        locale = user.lang_preference or "en"
        # Auto-inject name if not provided
        ctx = {"name": user.full_name, **context}
        try:
            subject, html, text = render(template_name, ctx, locale=locale)
        except Exception:
            logger.exception("template render failed for %s", template_name)
            return False

        try:
            await send_email(user.email, subject, html, text)
            return True
        except Exception:
            logger.exception("send_email failed for user=%s template=%s", user_id, template_name)
            return False
