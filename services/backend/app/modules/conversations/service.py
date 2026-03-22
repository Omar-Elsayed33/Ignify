import uuid
from typing import Any, Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import (
    BrandSettings,
    Channel,
    ChannelSkill,
    Message,
    MessageRole,
    Session,
    Skill,
    SkillInstallation,
)


async def get_or_create_session(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    channel_id: uuid.UUID,
    external_id: str,
    customer_name: Optional[str] = None,
    customer_phone: Optional[str] = None,
) -> Session:
    result = await db.execute(
        select(Session).where(
            Session.tenant_id == tenant_id,
            Session.channel_id == channel_id,
            Session.external_id == external_id,
        )
    )
    session = result.scalar_one_or_none()
    if session:
        if customer_name:
            session.customer_name = customer_name
        if customer_phone:
            session.customer_phone = customer_phone
        return session

    session = Session(
        tenant_id=tenant_id,
        channel_id=channel_id,
        external_id=external_id,
        customer_name=customer_name,
        customer_phone=customer_phone,
    )
    db.add(session)
    await db.flush()
    return session


async def load_channel_skills(db: AsyncSession, channel_id: uuid.UUID) -> list[Skill]:
    result = await db.execute(
        select(Skill)
        .join(SkillInstallation, Skill.id == SkillInstallation.skill_id)
        .join(ChannelSkill, ChannelSkill.skill_installation_id == SkillInstallation.id)
        .where(ChannelSkill.channel_id == channel_id, SkillInstallation.is_active == True)
    )
    return list(result.scalars().all())


async def build_system_prompt(db: AsyncSession, tenant_id: uuid.UUID, skills: list[Skill]) -> str:
    brand_result = await db.execute(
        select(BrandSettings).where(BrandSettings.tenant_id == tenant_id)
    )
    brand = brand_result.scalar_one_or_none()

    brand_name = brand.brand_name if brand else "our company"
    brand_voice = brand.brand_voice if brand and brand.brand_voice else "professional and friendly"

    parts = [
        f"You are an AI assistant for {brand_name}.",
        f"Your communication style should be: {brand_voice}.",
        "You help customers with their inquiries and provide accurate information.",
    ]

    for skill in skills:
        if skill.prompt_template:
            rendered = skill.prompt_template.replace("{brand_name}", brand_name).replace("{brand_voice}", brand_voice)
            parts.append(f"\n[Skill: {skill.name}]\n{rendered}")

    return "\n\n".join(parts)


async def get_conversation_history(db: AsyncSession, session_id: uuid.UUID, limit: int = 20) -> list[dict]:
    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    messages = list(reversed(result.scalars().all()))
    return [{"role": m.role.value, "content": m.content} for m in messages]


async def call_agno_runtime(
    system_prompt: str,
    messages: list[dict],
    tools: list[dict],
) -> str:
    payload = {
        "system_prompt": system_prompt,
        "messages": messages,
        "tools": tools,
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(f"{settings.AGNO_RUNTIME_URL}/v1/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", data.get("content", "I'm sorry, I couldn't process that request."))
    except Exception:
        return "I'm temporarily unable to process your request. Please try again shortly."


async def process_inbound_message(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    channel_id: uuid.UUID,
    external_id: str,
    content: str,
    customer_name: Optional[str] = None,
    customer_phone: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> tuple[uuid.UUID, str]:
    session = await get_or_create_session(db, tenant_id, channel_id, external_id, customer_name, customer_phone)

    # Store user message
    user_msg = Message(
        session_id=session.id,
        tenant_id=tenant_id,
        role=MessageRole.user,
        content=content,
        metadata_=metadata or {},
    )
    db.add(user_msg)
    await db.flush()

    # Load skills and build prompt
    skills = await load_channel_skills(db, channel_id)
    system_prompt = await build_system_prompt(db, tenant_id, skills)
    history = await get_conversation_history(db, session.id)

    # Collect tools from skills
    all_tools = []
    for skill in skills:
        if skill.tools:
            all_tools.extend(skill.tools)

    # Call AI runtime
    response_text = await call_agno_runtime(system_prompt, history, all_tools)

    # Store assistant response
    assistant_msg = Message(
        session_id=session.id,
        tenant_id=tenant_id,
        role=MessageRole.assistant,
        content=response_text,
    )
    db.add(assistant_msg)
    await db.flush()

    return session.id, response_text
