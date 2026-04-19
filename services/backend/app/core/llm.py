"""OpenRouter LLM gateway — single entry point for all model calls.

Key separation:
  - OPENROUTER_MANAGER_KEY: provisioning only (creates sub-keys) — never used here.
  - OPENROUTER_API_KEY: fallback inference key when tenant has no sub-key.
  - tenant sub-key (from tenant_ai_config): used for all per-tenant LLM calls.
"""
from __future__ import annotations

import logging

from langchain_openai import ChatOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)


def get_llm(
    model: str,
    tenant_id: str | None = None,
    temperature: float = 0.7,
    max_tokens: int | None = None,
    streaming: bool = False,
    api_key: str | None = None,
) -> ChatOpenAI:
    """Return a ChatOpenAI instance pointed at OpenRouter.

    Pass api_key explicitly (from get_llm_for_tenant) to use the tenant's sub-key.
    Falls back to the master OPENROUTER_API_KEY when api_key is None.
    """
    effective_key = api_key or settings.OPENROUTER_API_KEY
    headers = {
        "HTTP-Referer": settings.OPENROUTER_SITE_URL,
        "X-Title": settings.OPENROUTER_APP_NAME,
    }
    if tenant_id:
        headers["X-Tenant-Id"] = str(tenant_id)

    return ChatOpenAI(
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        streaming=streaming,
        api_key=effective_key,
        base_url=settings.OPENROUTER_BASE_URL,
        default_headers=headers,
    )


async def get_llm_for_tenant(
    model: str,
    tenant_id: str,
    db=None,
    temperature: float = 0.7,
    max_tokens: int | None = None,
    streaming: bool = False,
) -> ChatOpenAI:
    """Return a ChatOpenAI instance using the tenant's provisioned sub-key.

    Looks up TenantAIConfig, decrypts the sub-key, and passes it to get_llm.
    Falls back to master key if no config found (e.g. legacy tenants).
    """
    api_key: str | None = None

    if db is not None:
        try:
            from sqlalchemy import select
            from app.db.models import TenantOpenRouterConfig as TenantAIConfig
            from app.core.crypto import decrypt_token
            import uuid

            result = await db.execute(
                select(TenantAIConfig).where(TenantAIConfig.tenant_id == uuid.UUID(tenant_id))
            )
            config = result.scalar_one_or_none()
            if config and config.openrouter_key_encrypted:
                api_key = decrypt_token(config.openrouter_key_encrypted)
        except Exception as exc:
            logger.warning("Failed to load tenant AI key, using master key", extra={"tenant_id": tenant_id, "error": str(exc)})

    return get_llm(
        model=model,
        tenant_id=tenant_id,
        temperature=temperature,
        max_tokens=max_tokens,
        streaming=streaming,
        api_key=api_key,
    )
