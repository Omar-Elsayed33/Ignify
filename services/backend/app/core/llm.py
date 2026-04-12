"""OpenRouter LLM gateway — single entry point for all model calls."""
from langchain_openai import ChatOpenAI

from app.core.config import settings


def get_llm(
    model: str,
    tenant_id: str | None = None,
    temperature: float = 0.7,
    max_tokens: int | None = None,
    streaming: bool = False,
) -> ChatOpenAI:
    """Return a ChatOpenAI instance pointed at OpenRouter.

    tenant_id is forwarded as a header for cost attribution in OpenRouter analytics.
    """
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
        api_key=settings.OPENROUTER_API_KEY,
        base_url=settings.OPENROUTER_BASE_URL,
        default_headers=headers,
    )
