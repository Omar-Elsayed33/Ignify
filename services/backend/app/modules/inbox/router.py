from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status

from app.dependencies import CurrentUser, DbSession
from app.modules.inbox.schemas import (
    InboxConversationItem,
    InboxDraftRequest,
    InboxDraftResponse,
    InboxMessageItem,
    InboxSendRequest,
)
from app.modules.inbox.service import (
    draft_reply,
    link_conversation_to_lead,
    list_conversations,
    list_messages,
    record_sent_message,
)

router = APIRouter(prefix="/inbox", tags=["inbox"])


@router.post("/draft", response_model=InboxDraftResponse)
async def draft(data: InboxDraftRequest, user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenant")
    try:
        return await draft_reply(
            db,
            tenant_id=user.tenant_id,
            conversation_id=data.conversation_id,
            customer_message=data.customer_message,
            language=data.language,
            channel_type=data.channel_type,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inbox draft failed: {e}")


@router.get("/conversations", response_model=list[InboxConversationItem])
async def conversations(user: CurrentUser, db: DbSession, limit: int = 50):
    if not user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenant")
    return await list_conversations(db, tenant_id=user.tenant_id, limit=limit)


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=list[InboxMessageItem],
)
async def conversation_messages(
    conversation_id: uuid.UUID,
    user: CurrentUser,
    db: DbSession,
    limit: int = 200,
):
    if not user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenant")
    return await list_messages(
        db, tenant_id=user.tenant_id, conversation_id=conversation_id, limit=limit
    )


@router.post("/send", response_model=InboxMessageItem)
async def send(data: InboxSendRequest, user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenant")
    msg = await record_sent_message(
        db,
        tenant_id=user.tenant_id,
        conversation_id=data.conversation_id,
        content=data.message,
    )
    if not msg:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return msg


@router.post("/conversations/{conversation_id}/link-lead")
async def link_lead(
    conversation_id: uuid.UUID, user: CurrentUser, db: DbSession
):
    if not user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenant")
    result = await link_conversation_to_lead(
        db, tenant_id=user.tenant_id, conversation_id=conversation_id
    )
    if not result:
        raise HTTPException(status_code=404, detail="Conversation not found or no contact info")
    return result
