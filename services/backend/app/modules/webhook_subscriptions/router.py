"""Outgoing webhook subscriptions per tenant.

Supported events (call `dispatch_event(...)` from any module):
  - plan.generated
  - plan.approved
  - post.scheduled
  - post.published
  - lead.created

Dispatch is best-effort: a short-lived httpx.post with HMAC-SHA256 signing.
For reliability under high volume, move to Celery in a follow-up.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.url_safety import UnsafeURLError, validate_public_url
from app.db.models import Webhook
from app.dependencies import CurrentUser, DbSession

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhook-subscriptions", tags=["webhook-subscriptions"])

SUPPORTED_EVENTS = {
    "plan.generated",
    "plan.approved",
    "post.scheduled",
    "post.published",
    "lead.created",
}


class CreateWebhookRequest(BaseModel):
    url: HttpUrl
    events: list[str] = Field(default_factory=list)


class WebhookResponse(BaseModel):
    id: str
    url: str
    events: list[str]
    is_active: bool
    last_delivery_at: datetime | None
    last_status_code: int | None
    created_at: datetime


class CreateWebhookResponse(BaseModel):
    # Secret shown ONCE at creation for HMAC verification on the receiver side.
    secret: str
    record: WebhookResponse


def _serialize(row: Webhook) -> WebhookResponse:
    return WebhookResponse(
        id=str(row.id),
        url=row.url,
        events=row.events or [],
        is_active=row.is_active,
        last_delivery_at=row.last_delivery_at,
        last_status_code=row.last_status_code,
        created_at=row.created_at,
    )


@router.get("", response_model=list[WebhookResponse])
async def list_webhooks(user: CurrentUser, db: DbSession):
    if user.role not in {"owner", "admin", "superadmin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")

    result = await db.execute(
        select(Webhook)
        .where(Webhook.tenant_id == user.tenant_id)
        .order_by(Webhook.created_at.desc())
    )
    return [_serialize(r) for r in result.scalars().all()]


@router.get("/events")
async def list_supported_events():
    return {"events": sorted(SUPPORTED_EVENTS)}


@router.post("", response_model=CreateWebhookResponse, status_code=201)
async def create_webhook(
    data: CreateWebhookRequest, user: CurrentUser, db: DbSession
):
    if user.role not in {"owner", "admin", "superadmin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")

    invalid = set(data.events) - SUPPORTED_EVENTS
    if invalid:
        raise HTTPException(status_code=400, detail=f"unknown_events: {sorted(invalid)}")
    if not data.events:
        raise HTTPException(status_code=400, detail="events_required")

    # SSRF protection: the tenant controls the URL. Validate it points to a
    # public IP and (in production) uses HTTPS before we ever persist it.
    # This prevents a tenant from registering `http://redis:6379/...` as a
    # webhook target and turning our backend into an internal-network scanner.
    require_https = not settings.DEBUG
    try:
        safe_url = validate_public_url(str(data.url), require_https=require_https)
    except UnsafeURLError as e:
        raise HTTPException(status_code=422, detail=f"invalid_webhook_url: {e}") from None

    secret = "whsec_" + secrets.token_urlsafe(28)
    row = Webhook(
        tenant_id=user.tenant_id,
        created_by=user.id,
        url=safe_url,
        events=list(data.events),
        secret=secret,
        is_active=True,
    )
    db.add(row)
    await db.flush()
    return CreateWebhookResponse(secret=secret, record=_serialize(row))


@router.delete("/{webhook_id}", status_code=204)
async def delete_webhook(webhook_id: uuid.UUID, user: CurrentUser, db: DbSession):
    if user.role not in {"owner", "admin", "superadmin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")

    result = await db.execute(
        select(Webhook).where(
            Webhook.id == webhook_id, Webhook.tenant_id == user.tenant_id
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    await db.delete(row)
    await db.flush()
    return


# ── Dispatch helper ────────────────────────────────────────────────────────────
# Delivery discipline — keep these small. A single tenant with 10 webhooks
# shouldn't block the caller. For volume, move dispatch to Celery in Phase 3.
_DISPATCH_TIMEOUT_SECONDS = 5.0
_DISPATCH_MAX_RETRIES = 0  # No retry in inline dispatch; Celery will add retries later.


async def dispatch_event(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    event: str,
    payload: dict[str, Any],
) -> None:
    """Fire-and-forget POST to every active webhook subscribed to `event` for this tenant.

    Each delivery:
    - Re-validates the destination URL (defense-in-depth for rows created before
      SSRF checks were added or if DNS rebinding attempts were made since).
    - Signs the body with HMAC-SHA256 using the per-webhook secret.
    - Records the response status code; failures leave status_code=0.
    - Never logs the secret.
    """
    if event not in SUPPORTED_EVENTS:
        logger.warning("dispatch_event: unknown event %r (tenant=%s)", event, tenant_id)
        return

    result = await db.execute(
        select(Webhook).where(
            Webhook.tenant_id == tenant_id, Webhook.is_active.is_(True)
        )
    )
    hooks = [h for h in result.scalars().all() if event in (h.events or [])]
    if not hooks:
        return

    body = json.dumps(
        {"event": event, "payload": payload, "ts": datetime.now(timezone.utc).isoformat()}
    ).encode()
    require_https = not settings.DEBUG

    # follow_redirects=False prevents redirect-based SSRF at delivery time.
    # A legit webhook receiver doesn't need to redirect our POSTs.
    async with httpx.AsyncClient(
        timeout=_DISPATCH_TIMEOUT_SECONDS, follow_redirects=False
    ) as client:
        for hook in hooks:
            try:
                safe_url = validate_public_url(hook.url, require_https=require_https)
            except UnsafeURLError as e:
                logger.warning(
                    "webhook delivery skipped — url failed safety check webhook_id=%s err=%s",
                    hook.id, e,
                )
                hook.last_delivery_at = datetime.now(timezone.utc)
                hook.last_status_code = 0
                continue

            sig = hmac.new(hook.secret.encode(), body, hashlib.sha256).hexdigest()
            try:
                resp = await client.post(
                    safe_url,
                    content=body,
                    headers={
                        "Content-Type": "application/json",
                        "X-Ignify-Event": event,
                        "X-Ignify-Signature": f"sha256={sig}",
                    },
                )
                hook.last_delivery_at = datetime.now(timezone.utc)
                hook.last_status_code = resp.status_code
            except Exception as e:  # noqa: BLE001
                # Never include the secret in logs. The URL alone is fine.
                logger.warning(
                    "webhook delivery failed webhook_id=%s err=%s", hook.id, e,
                )
                hook.last_delivery_at = datetime.now(timezone.utc)
                hook.last_status_code = 0
    await db.flush()
