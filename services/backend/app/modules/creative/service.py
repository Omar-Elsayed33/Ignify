import uuid
from typing import Any, Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import CreativeAsset


async def generate_image(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    prompt: str,
    asset_type: str,
    name: Optional[str] = None,
    width: int = 1024,
    height: int = 1024,
    style: Optional[str] = None,
) -> CreativeAsset:
    enhanced_prompt = prompt
    if style:
        enhanced_prompt = f"{prompt}, style: {style}"

    file_url = None
    thumbnail_url = None

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{settings.AGNO_RUNTIME_URL}/v1/images/generate",
                json={
                    "prompt": enhanced_prompt,
                    "width": width,
                    "height": height,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            file_url = data.get("url", data.get("image_url"))
            thumbnail_url = data.get("thumbnail_url", file_url)
    except Exception:
        file_url = None
        thumbnail_url = None

    asset = CreativeAsset(
        tenant_id=tenant_id,
        name=name or f"Generated {asset_type}",
        asset_type=asset_type,
        file_url=file_url,
        thumbnail_url=thumbnail_url,
        prompt_used=prompt,
        metadata_={
            "width": width,
            "height": height,
            "style": style,
            "ai_generated": True,
            "generation_status": "completed" if file_url else "failed",
        },
    )
    db.add(asset)
    await db.flush()
    return asset
