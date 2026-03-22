import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import Channel, Message, MessageRole, Session
from app.dependencies import CurrentUser, DbSession
from app.modules.conversations.schemas import (
    InboundMessageRequest,
    InboundMessageResponse,
    MessageResponse,
    SessionResponse,
    ToolCallbackRequest,
)
from app.modules.conversations.service import process_inbound_message

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("/sessions", response_model=list[SessionResponse])
async def list_sessions(
    user: CurrentUser,
    db: DbSession,
    channel_id: uuid.UUID | None = None,
    skip: int = 0,
    limit: int = 50,
):
    query = select(Session).where(Session.tenant_id == user.tenant_id)
    if channel_id:
        query = query.where(Session.channel_id == channel_id)
    query = query.order_by(Session.updated_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/sessions/{session_id}/messages", response_model=list[MessageResponse])
async def get_session_messages(
    session_id: uuid.UUID,
    user: CurrentUser,
    db: DbSession,
    skip: int = 0,
    limit: int = 100,
):
    # Verify session belongs to tenant
    sess_result = await db.execute(
        select(Session).where(Session.id == session_id, Session.tenant_id == user.tenant_id)
    )
    if not sess_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id, Message.tenant_id == user.tenant_id)
        .order_by(Message.created_at.asc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/inbound", response_model=InboundMessageResponse)
async def inbound_message(
    data: InboundMessageRequest,
    user: CurrentUser,
    db: DbSession,
):
    # Verify channel belongs to tenant
    ch_result = await db.execute(
        select(Channel).where(Channel.id == data.channel_id, Channel.tenant_id == user.tenant_id)
    )
    if not ch_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")

    session_id, response = await process_inbound_message(
        db=db,
        tenant_id=user.tenant_id,
        channel_id=data.channel_id,
        external_id=data.external_id,
        content=data.content,
        customer_name=data.customer_name,
        customer_phone=data.customer_phone,
        metadata=data.metadata,
    )
    return InboundMessageResponse(session_id=session_id, response=response)


@router.post("/tool-callback")
async def tool_callback(
    data: ToolCallbackRequest,
    user: CurrentUser,
    db: DbSession,
):
    sess_result = await db.execute(
        select(Session).where(Session.id == data.session_id, Session.tenant_id == user.tenant_id)
    )
    session = sess_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    tool_msg = Message(
        session_id=session.id,
        tenant_id=user.tenant_id,
        role=MessageRole.tool,
        content=str(data.tool_result),
        metadata_={"tool_name": data.tool_name},
    )
    db.add(tool_msg)
    await db.flush()
    return {"status": "ok", "message": "Tool callback recorded"}
