"""Inbox service — draft AI replies for inbound customer messages."""
from __future__ import annotations

import time
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.registry import get_agent
from app.db.models import (
    AgentRun,
    BrandSettings,
    Channel,
    Message,
    MessageRole,
    Session,
    Tenant,
)
from app.modules.inbox.schemas import InboxDraftResponse


async def _load_brand_voice(db: AsyncSession, tenant_id: uuid.UUID) -> dict[str, Any]:
    brand = (
        await db.execute(select(BrandSettings).where(BrandSettings.tenant_id == tenant_id))
    ).scalar_one_or_none()
    if not brand:
        return {}
    return {
        "tone": getattr(brand, "tone", None),
        "brand_name": getattr(brand, "brand_name", None),
        "voice": getattr(brand, "brand_voice", None),
    }


async def _load_knowledge_base(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    tenant = (
        await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    ).scalar_one_or_none()
    if not tenant or not tenant.config:
        return ""
    kb = tenant.config.get("knowledge_base", "")
    return kb if isinstance(kb, str) else ""


async def _load_history(
    db: AsyncSession, tenant_id: uuid.UUID, session_id: uuid.UUID, limit: int = 10
) -> list[dict[str, Any]]:
    rows = (
        await db.execute(
            select(Message)
            .where(Message.session_id == session_id, Message.tenant_id == tenant_id)
            .order_by(Message.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    return [
        {"role": m.role.value if hasattr(m.role, "value") else str(m.role), "content": m.content}
        for m in reversed(rows)
    ]


async def draft_reply(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    conversation_id: uuid.UUID,
    customer_message: str,
    language: str,
    channel_type: str,
) -> InboxDraftResponse:
    # Validate conversation belongs to tenant
    sess = (
        await db.execute(
            select(Session).where(
                Session.id == conversation_id, Session.tenant_id == tenant_id
            )
        )
    ).scalar_one_or_none()

    history: list[dict[str, Any]] = []
    if sess:
        history = await _load_history(db, tenant_id, sess.id)

    brand_voice = await _load_brand_voice(db, tenant_id)
    kb = await _load_knowledge_base(db, tenant_id)

    run = AgentRun(
        tenant_id=tenant_id,
        agent_name="inbox",
        thread_id=f"inbox:{conversation_id}",
        input={
            "conversation_id": str(conversation_id),
            "customer_message": customer_message,
            "language": language,
            "channel_type": channel_type,
        },
        status="running",
    )
    db.add(run)
    await db.flush()

    started = time.perf_counter()
    try:
        agent = get_agent("inbox", str(tenant_id))
        result = await agent.run(
            {
                "tenant_id": str(tenant_id),
                "conversation_id": str(conversation_id),
                "channel_type": channel_type,
                "language": language,
                "customer_message": customer_message,
                "conversation_history": history,
                "knowledge_base": kb,
                "brand_voice": brand_voice,
                "needs_human": False,
                "meta": {},
            },
            thread_id=f"inbox:{conversation_id}",
        )
        run.status = "succeeded"
        run.output = {k: v for k, v in result.items() if k != "tenant_id"}
        run.model = agent.model
        run.latency_ms = int((time.perf_counter() - started) * 1000)
        await db.commit()
    except Exception as e:
        run.status = "failed"
        run.error = str(e)[:2000]
        run.latency_ms = int((time.perf_counter() - started) * 1000)
        await db.commit()
        raise

    return InboxDraftResponse(
        draft_reply=result.get("draft_reply") or "",
        intent=result.get("intent"),
        confidence=result.get("confidence"),
        needs_human=bool(result.get("needs_human", False)),
        meta=result.get("meta") or {},
    )


async def list_conversations(
    db: AsyncSession, tenant_id: uuid.UUID, limit: int = 50
) -> list[dict[str, Any]]:
    sessions = (
        await db.execute(
            select(Session, Channel)
            .join(Channel, Channel.id == Session.channel_id)
            .where(Session.tenant_id == tenant_id)
            .order_by(Session.updated_at.desc())
            .limit(limit)
        )
    ).all()

    items: list[dict[str, Any]] = []
    for sess, ch in sessions:
        last = (
            await db.execute(
                select(Message)
                .where(
                    Message.session_id == sess.id,
                    Message.tenant_id == tenant_id,
                )
                .order_by(Message.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        items.append(
            {
                "id": sess.id,
                "channel_id": sess.channel_id,
                "channel_type": ch.type.value if hasattr(ch.type, "value") else str(ch.type),
                "customer_name": sess.customer_name,
                "customer_phone": sess.customer_phone,
                "last_message": (last.content[:200] if last else None),
                "last_message_at": (last.created_at if last else None),
                "updated_at": sess.updated_at,
            }
        )
    return items


async def list_messages(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    conversation_id: uuid.UUID,
    limit: int = 200,
) -> list[Message]:
    sess = (
        await db.execute(
            select(Session).where(
                Session.id == conversation_id, Session.tenant_id == tenant_id
            )
        )
    ).scalar_one_or_none()
    if not sess:
        return []
    rows = (
        await db.execute(
            select(Message)
            .where(Message.session_id == conversation_id, Message.tenant_id == tenant_id)
            .order_by(Message.created_at.asc())
            .limit(limit)
        )
    ).scalars().all()
    return list(rows)


async def record_sent_message(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    conversation_id: uuid.UUID,
    content: str,
) -> Message | None:
    sess = (
        await db.execute(
            select(Session).where(
                Session.id == conversation_id, Session.tenant_id == tenant_id
            )
        )
    ).scalar_one_or_none()
    if not sess:
        return None
    msg = Message(
        session_id=sess.id,
        tenant_id=tenant_id,
        role=MessageRole.assistant,
        content=content,
        metadata_={"source": "inbox_ai"},
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    # Try to auto-create a lead from the conversation metadata.
    # Must never break the inbox flow.
    try:
        from app.modules.channels import service as _noop  # noqa: F401
    except Exception:
        pass
    try:
        from app.db.models import Channel as _Channel  # local import

        channel = (
            await db.execute(
                select(_Channel).where(_Channel.id == sess.channel_id)
            )
        ).scalar_one_or_none()
        channel_type = (
            channel.type.value if channel and hasattr(channel.type, "value") else (str(channel.type) if channel else None)
        )
        from app.modules.leads.service import auto_create_from_conversation

        await auto_create_from_conversation(
            db,
            tenant_id=tenant_id,
            conversation_id=sess.id,
            customer_name=getattr(sess, "customer_name", None),
            customer_phone=getattr(sess, "customer_phone", None),
            customer_email=getattr(sess, "customer_email", None),
            source=channel_type,
        )
    except Exception:
        # Never break inbox flow on lead-side issues
        pass

    return msg


async def link_conversation_to_lead(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    conversation_id: uuid.UUID,
) -> dict[str, Any] | None:
    """Explicit endpoint handler: look up conversation & create/link a lead."""
    from app.db.models import Channel as _Channel
    from app.modules.leads.service import auto_create_from_conversation

    sess = (
        await db.execute(
            select(Session).where(
                Session.id == conversation_id, Session.tenant_id == tenant_id
            )
        )
    ).scalar_one_or_none()
    if not sess:
        return None
    channel = (
        await db.execute(select(_Channel).where(_Channel.id == sess.channel_id))
    ).scalar_one_or_none()
    channel_type = (
        channel.type.value if channel and hasattr(channel.type, "value") else (str(channel.type) if channel else None)
    )
    lead = await auto_create_from_conversation(
        db,
        tenant_id=tenant_id,
        conversation_id=sess.id,
        customer_name=getattr(sess, "customer_name", None),
        customer_phone=getattr(sess, "customer_phone", None),
        customer_email=getattr(sess, "customer_email", None),
        source=channel_type,
    )
    if not lead:
        return None
    return {"lead_id": str(lead.id), "name": lead.name}
