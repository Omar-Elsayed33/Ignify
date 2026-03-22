import uuid
from typing import Any, Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import BrandSettings


async def generate_content(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    topic: str,
    post_type: str,
    platform: Optional[str] = None,
    tone: Optional[str] = None,
    keywords: Optional[list[str]] = None,
    max_length: Optional[int] = None,
) -> dict[str, Any]:
    # Load brand settings
    brand_result = await db.execute(
        select(BrandSettings).where(BrandSettings.tenant_id == tenant_id)
    )
    brand = brand_result.scalar_one_or_none()

    brand_name = brand.brand_name if brand else "the brand"
    brand_voice = brand.brand_voice if brand and brand.brand_voice else "professional"
    use_tone = tone or (brand.tone if brand else "professional")

    system_prompt = (
        f"You are a content creation expert for {brand_name}. "
        f"Your writing style should be {use_tone} and match this brand voice: {brand_voice}. "
        f"Generate high-quality {post_type} content."
    )

    user_prompt_parts = [f"Write a {post_type} about: {topic}"]
    if platform:
        user_prompt_parts.append(f"Platform: {platform}")
    if keywords:
        user_prompt_parts.append(f"Include keywords: {', '.join(keywords)}")
    if max_length:
        user_prompt_parts.append(f"Maximum length: {max_length} words")
    user_prompt_parts.append("Return the content with a title and body.")

    user_prompt = "\n".join(user_prompt_parts)

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{settings.AGNO_RUNTIME_URL}/v1/chat",
                json={
                    "system_prompt": system_prompt,
                    "messages": [{"role": "user", "content": user_prompt}],
                    "tools": [],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            response_text = data.get("response", data.get("content", ""))

            # Parse title and body from response
            lines = response_text.strip().split("\n", 1)
            title = lines[0].strip().lstrip("#").strip() if lines else topic
            body = lines[1].strip() if len(lines) > 1 else response_text

            return {
                "title": title,
                "body": body,
                "metadata": {"topic": topic, "post_type": post_type, "platform": platform, "ai_generated": True},
            }
    except Exception:
        return {
            "title": f"{post_type.title()} about {topic}",
            "body": f"Content generation is temporarily unavailable. Topic: {topic}",
            "metadata": {"topic": topic, "error": True},
        }
