import uuid
from typing import Any, Optional

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import (
    AdCampaign,
    BrandSettings,
    Campaign,
    Channel,
    ContentPost,
    CreditBalance,
    Lead,
    SocialPost,
)


async def build_marketing_context(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    """Build a marketing-aware context string from tenant data."""
    parts = []

    # Brand info
    brand_result = await db.execute(select(BrandSettings).where(BrandSettings.tenant_id == tenant_id))
    brand = brand_result.scalar_one_or_none()
    if brand:
        parts.append(f"Brand: {brand.brand_name or 'N/A'}, Voice: {brand.brand_voice or 'N/A'}, Tone: {brand.tone or 'N/A'}")

    # Stats
    leads_count = (await db.execute(select(func.count(Lead.id)).where(Lead.tenant_id == tenant_id))).scalar() or 0
    campaigns_count = (await db.execute(select(func.count(Campaign.id)).where(Campaign.tenant_id == tenant_id))).scalar() or 0
    channels_count = (await db.execute(select(func.count(Channel.id)).where(Channel.tenant_id == tenant_id))).scalar() or 0
    content_count = (await db.execute(select(func.count(ContentPost.id)).where(ContentPost.tenant_id == tenant_id))).scalar() or 0

    parts.append(f"Current stats - Leads: {leads_count}, Campaigns: {campaigns_count}, Channels: {channels_count}, Content pieces: {content_count}")

    balance_result = await db.execute(select(CreditBalance).where(CreditBalance.tenant_id == tenant_id))
    balance = balance_result.scalar_one_or_none()
    if balance:
        parts.append(f"Credit balance: {balance.balance}")

    return "\n".join(parts)


async def build_system_prompt(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    context = await build_marketing_context(db, tenant_id)
    return (
        "You are Ignify AI Assistant - an expert marketing advisor. "
        "You help users with marketing strategy, content creation, campaign planning, "
        "SEO optimization, social media management, ad campaign optimization, "
        "lead management, and competitive analysis.\n\n"
        "Here is the current marketing context for this business:\n"
        f"{context}\n\n"
        "Provide actionable, data-driven marketing advice. "
        "Be concise but thorough. When relevant, suggest specific actions "
        "the user can take within the Ignify platform."
    )


async def chat_with_assistant(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    message: str,
    context: Optional[dict[str, Any]] = None,
    conversation_history: Optional[list[dict[str, str]]] = None,
) -> dict[str, Any]:
    system_prompt = await build_system_prompt(db, tenant_id)

    messages = []
    if conversation_history:
        messages.extend(conversation_history)
    messages.append({"role": "user", "content": message})

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{settings.AGNO_RUNTIME_URL}/v1/chat",
                json={
                    "system_prompt": system_prompt,
                    "messages": messages,
                    "tools": [],
                    "context": context or {},
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "response": data.get("response", data.get("content", "I apologize, I could not process that.")),
                "metadata": {"model": data.get("model"), "usage": data.get("usage")},
            }
    except Exception as e:
        return {
            "response": "I'm temporarily unable to process your request. Please try again shortly.",
            "metadata": {"error": str(e)},
        }
