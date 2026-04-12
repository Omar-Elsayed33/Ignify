import uuid
from typing import Any, Optional

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import (
    Campaign,
    Channel,
    ContentPost,
    CreditBalance,
    Lead,
    SocialPost,
    Tenant,
)


async def get_tenant_ai_config(db: AsyncSession, tenant_id: uuid.UUID) -> dict[str, str]:
    """Get tenant's AI provider config from tenant.config JSON."""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant or not tenant.config:
        return {}
    cfg = tenant.config if isinstance(tenant.config, dict) else {}
    return {
        "provider": cfg.get("ai_provider", ""),
        "model": cfg.get("ai_model", ""),
        "api_key": cfg.get("ai_api_key", ""),
        "base_url": cfg.get("ai_base_url", ""),
    }


async def build_marketing_context(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    """Build a marketing-aware context string from tenant data."""
    parts = []

    # Tenant info
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_result.scalar_one_or_none()
    if tenant:
        cfg = tenant.config or {}
        brand_name = cfg.get("brand_name", tenant.name)
        brand_voice = cfg.get("brand_voice", "professional")
        parts.append(f"Business: {brand_name}, Voice: {brand_voice}")

    # Stats
    leads_count = (await db.execute(select(func.count(Lead.id)).where(Lead.tenant_id == tenant_id))).scalar() or 0
    campaigns_count = (await db.execute(select(func.count(Campaign.id)).where(Campaign.tenant_id == tenant_id))).scalar() or 0
    channels_count = (await db.execute(select(func.count(Channel.id)).where(Channel.tenant_id == tenant_id))).scalar() or 0
    content_count = (await db.execute(select(func.count(ContentPost.id)).where(ContentPost.tenant_id == tenant_id))).scalar() or 0

    parts.append(f"Current stats - Leads: {leads_count}, Campaigns: {campaigns_count}, Channels: {channels_count}, Content: {content_count}")

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
    # Get tenant AI config
    ai_config = await get_tenant_ai_config(db, tenant_id)

    provider = ai_config.get("provider", "")
    api_key = ai_config.get("api_key", "")
    model = ai_config.get("model", "")

    # Check if AI is configured
    if not provider or not api_key:
        # Fall back to platform defaults from env
        if settings.OPENAI_API_KEY:
            provider = "openai"
            api_key = settings.OPENAI_API_KEY
            model = model or "gpt-4o"
        elif settings.ANTHROPIC_API_KEY:
            provider = "anthropic"
            api_key = settings.ANTHROPIC_API_KEY
            model = model or "claude-sonnet-4-20250514"
        elif settings.GOOGLE_API_KEY:
            provider = "google"
            api_key = settings.GOOGLE_API_KEY
            model = model or "gemini-2.0-flash"
        else:
            return {
                "response": (
                    "**AI provider not configured.**\n\n"
                    "To use the AI Assistant, please configure an AI provider:\n\n"
                    "1. Go to **Settings** > **AI Configuration**\n"
                    "2. Select a provider (OpenAI, Anthropic, Google, or OpenRouter)\n"
                    "3. Enter your API key\n"
                    "4. Select a model\n"
                    "5. Click **Save Settings**\n\n"
                    "Or ask your platform admin to set default AI provider keys."
                ),
                "metadata": {"error": "no_ai_provider_configured"},
            }

    if not model:
        model = "gpt-4o" if provider == "openai" else "claude-sonnet-4-20250514" if provider == "anthropic" else "gemini-2.0-flash"

    system_prompt = await build_system_prompt(db, tenant_id)

    messages = []
    if conversation_history:
        messages.extend(conversation_history)
    messages.append({"role": "user", "content": message})

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{settings.AGNO_RUNTIME_URL}/execute",
                json={
                    "provider": provider,
                    "api_key": api_key,
                    "model": model,
                    "system_prompt": system_prompt,
                    "messages": messages,
                    "tools": [],
                    "temperature": 0.7,
                    "max_tokens": 4096,
                },
            )
            if resp.status_code != 200:
                error_detail = resp.text[:200]
                return {
                    "response": f"**AI provider error** ({provider}/{model}):\n\n{error_detail}\n\nPlease check your API key in **Settings > AI Configuration**.",
                    "metadata": {"error": f"agno_{resp.status_code}", "detail": error_detail},
                }
            data = resp.json()
            return {
                "response": data.get("response", "No response from AI."),
                "metadata": {
                    "model": model,
                    "provider": provider,
                    "usage": data.get("usage"),
                    "tool_calls_made": data.get("tool_calls_made", 0),
                },
            }
    except httpx.TimeoutException:
        return {
            "response": "**Request timed out.** The AI took too long to respond. Try a shorter message or a faster model.",
            "metadata": {"error": "timeout", "provider": provider, "model": model},
        }
    except httpx.ConnectError:
        return {
            "response": "**Cannot reach AI runtime.** The AGNO service may be down. Please contact your admin.",
            "metadata": {"error": "agno_unreachable"},
        }
    except Exception as e:
        return {
            "response": f"**Unexpected error:** {str(e)}\n\nPlease try again or check your AI configuration in Settings.",
            "metadata": {"error": str(type(e).__name__), "detail": str(e)},
        }
