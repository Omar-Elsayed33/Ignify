"""Meta Platforms webhooks: WhatsApp Cloud, Instagram DM, Messenger.

All three use Meta's standard webhook verification (GET hub.challenge) and
HMAC SHA256 signature (X-Hub-Signature-256) for POST payloads.

Handlers are intentionally short, idempotent, and defensive — Meta retries
on non-2xx responses, so we always return 200 once a signature is valid,
even if payload shape is unexpected.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.database import get_db
from app.db.models import Channel, ChannelType, Message, MessageRole, Session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


# ─────────────────────────── signature / challenge ──────────────────────────

def _verify_signature(body: bytes, signature_header: str | None) -> bool:
    if not settings.META_APP_SECRET or not signature_header:
        return False
    expected = "sha256=" + hmac.new(
        settings.META_APP_SECRET.encode(), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)


def _challenge_response(hub_mode: str | None, hub_verify_token: str | None, hub_challenge: str | None):
    if hub_mode == "subscribe" and hub_verify_token == settings.META_WEBHOOK_VERIFY_TOKEN and hub_challenge:
        return PlainTextResponse(content=hub_challenge, status_code=200)
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Verification failed")


# ─────────────────────────── storage helpers ────────────────────────────────

async def _find_channel(
    db: AsyncSession, channel_type: ChannelType, match_key: str, match_value: str
) -> Channel | None:
    """Find a Channel whose config[match_key] == match_value."""
    rows = (
        await db.execute(select(Channel).where(Channel.type == channel_type))
    ).scalars().all()
    for ch in rows:
        cfg = ch.config or {}
        if str(cfg.get(match_key, "")) == str(match_value):
            return ch
    return None


async def _find_session(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    channel_id: uuid.UUID,
    external_user_id: str,
) -> Session | None:
    return (
        await db.execute(
            select(Session).where(
                Session.tenant_id == tenant_id,
                Session.channel_id == channel_id,
                Session.external_id == external_user_id,
            )
        )
    ).scalar_one_or_none()


async def _store_incoming_message(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    channel_id: uuid.UUID,
    external_user_id: str,
    text: str,
    metadata: dict[str, Any],
    external_msg_id: str | None = None,
    customer_name: str | None = None,
    customer_phone: str | None = None,
) -> Message | None:
    """Upsert session + append message. Dedup by external_msg_id in metadata."""
    # Dedup
    if external_msg_id:
        existing = (
            await db.execute(
                select(Message).where(
                    Message.tenant_id == tenant_id,
                    Message.metadata_["external_id"].astext == external_msg_id,
                )
            )
        ).scalar_one_or_none()
        if existing:
            return existing

    sess = await _find_session(db, tenant_id, channel_id, external_user_id)
    if sess is None:
        sess = Session(
            tenant_id=tenant_id,
            channel_id=channel_id,
            external_id=external_user_id,
            customer_name=customer_name,
            customer_phone=customer_phone,
            metadata_={"source": "webhook"},
        )
        db.add(sess)
        await db.flush()

    msg_meta: dict[str, Any] = {"source": "webhook", **(metadata or {})}
    if external_msg_id:
        msg_meta["external_id"] = external_msg_id

    msg = Message(
        session_id=sess.id,
        tenant_id=tenant_id,
        role=MessageRole.user,
        content=text or "",
        metadata_=msg_meta,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    # Best-effort lead auto-creation
    try:
        from app.modules.leads.service import auto_create_from_conversation

        await auto_create_from_conversation(
            db,
            tenant_id=tenant_id,
            conversation_id=sess.id,
            customer_name=sess.customer_name,
            customer_phone=sess.customer_phone,
            customer_email=None,
            source=None,
        )
    except Exception as e:  # pragma: no cover
        logger.debug("auto_create_from_conversation failed: %s", e)

    return msg


# ─────────────────────────── WhatsApp Cloud API ─────────────────────────────

@router.get("/whatsapp")
async def whatsapp_verify(
    hub_mode: str | None = Query(None, alias="hub.mode"),
    hub_verify_token: str | None = Query(None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(None, alias="hub.challenge"),
):
    return _challenge_response(hub_mode, hub_verify_token, hub_challenge)


@router.post("/whatsapp")
async def whatsapp_receive(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.body()
    sig = request.headers.get("X-Hub-Signature-256")
    if not _verify_signature(body, sig):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid signature")

    try:
        payload = json.loads(body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return {"status": "ignored"}

    for entry in payload.get("entry", []) or []:
        for change in entry.get("changes", []) or []:
            value = change.get("value", {}) or {}
            metadata = value.get("metadata", {}) or {}
            phone_number_id = metadata.get("phone_number_id")
            if not phone_number_id:
                continue
            channel = await _find_channel(db, ChannelType.whatsapp, "phone_number_id", phone_number_id)
            if not channel:
                logger.info("whatsapp webhook: no channel for phone_number_id=%s", phone_number_id)
                continue

            contacts = {c.get("wa_id"): c for c in (value.get("contacts") or [])}
            for msg in value.get("messages", []) or []:
                wa_from = msg.get("from")
                msg_id = msg.get("id")
                mtype = msg.get("type", "text")
                text = (msg.get("text") or {}).get("body", "") if mtype == "text" else f"[{mtype}]"
                contact = contacts.get(wa_from, {})
                profile = (contact.get("profile") or {})
                try:
                    await _store_incoming_message(
                        db,
                        tenant_id=channel.tenant_id,
                        channel_id=channel.id,
                        external_user_id=wa_from or "unknown",
                        text=text,
                        metadata={"type": mtype, "raw": msg},
                        external_msg_id=msg_id,
                        customer_name=profile.get("name"),
                        customer_phone=wa_from,
                    )
                except Exception as e:
                    logger.exception("whatsapp store failed: %s", e)

    return {"status": "ok"}


# ─────────────────────────── Instagram DM ───────────────────────────────────

@router.get("/instagram")
async def instagram_verify(
    hub_mode: str | None = Query(None, alias="hub.mode"),
    hub_verify_token: str | None = Query(None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(None, alias="hub.challenge"),
):
    return _challenge_response(hub_mode, hub_verify_token, hub_challenge)


@router.post("/instagram")
async def instagram_receive(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.body()
    sig = request.headers.get("X-Hub-Signature-256")
    if not _verify_signature(body, sig):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid signature")

    try:
        payload = json.loads(body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return {"status": "ignored"}

    # Messenger-style: entry[].messaging[].{sender,recipient,message}
    for entry in payload.get("entry", []) or []:
        ig_account_id = entry.get("id")  # IG business account id
        channel = await _find_channel(db, ChannelType.instagram, "ig_account_id", ig_account_id) if ig_account_id else None
        if not channel:
            continue
        for event in entry.get("messaging", []) or []:
            sender_id = (event.get("sender") or {}).get("id")
            msg = event.get("message") or {}
            if not sender_id or not msg:
                continue
            msg_id = msg.get("mid")
            text = msg.get("text", "") or "[attachment]"
            try:
                await _store_incoming_message(
                    db,
                    tenant_id=channel.tenant_id,
                    channel_id=channel.id,
                    external_user_id=sender_id,
                    text=text,
                    metadata={"raw": event},
                    external_msg_id=msg_id,
                )
            except Exception as e:
                logger.exception("instagram store failed: %s", e)

    return {"status": "ok"}


# ─────────────────────────── Messenger ──────────────────────────────────────

@router.get("/messenger")
async def messenger_verify(
    hub_mode: str | None = Query(None, alias="hub.mode"),
    hub_verify_token: str | None = Query(None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(None, alias="hub.challenge"),
):
    return _challenge_response(hub_mode, hub_verify_token, hub_challenge)


@router.post("/messenger")
async def messenger_receive(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.body()
    sig = request.headers.get("X-Hub-Signature-256")
    if not _verify_signature(body, sig):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid signature")

    try:
        payload = json.loads(body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return {"status": "ignored"}

    for entry in payload.get("entry", []) or []:
        page_id = entry.get("id")
        channel = await _find_channel(db, ChannelType.messenger, "page_id", page_id) if page_id else None
        if not channel:
            continue
        for event in entry.get("messaging", []) or []:
            sender_id = (event.get("sender") or {}).get("id")
            msg = event.get("message") or {}
            if not sender_id or not msg:
                continue
            msg_id = msg.get("mid")
            text = msg.get("text", "") or "[attachment]"
            try:
                await _store_incoming_message(
                    db,
                    tenant_id=channel.tenant_id,
                    channel_id=channel.id,
                    external_user_id=sender_id,
                    text=text,
                    metadata={"raw": event},
                    external_msg_id=msg_id,
                )
            except Exception as e:
                logger.exception("messenger store failed: %s", e)

    return {"status": "ok"}
