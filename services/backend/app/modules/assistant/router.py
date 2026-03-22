from fastapi import APIRouter

from app.dependencies import CurrentUser, DbSession
from app.modules.assistant.schemas import ChatRequest, ChatResponse
from app.modules.assistant.service import chat_with_assistant

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/chat", response_model=ChatResponse)
async def chat(data: ChatRequest, user: CurrentUser, db: DbSession):
    result = await chat_with_assistant(
        db=db,
        tenant_id=user.tenant_id,
        message=data.message,
        context=data.context,
        conversation_history=data.conversation_history,
    )
    return ChatResponse(**result)
