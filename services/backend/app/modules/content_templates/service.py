from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ContentTemplate


async def list_templates(db: AsyncSession, tenant_id: uuid.UUID) -> list[ContentTemplate]:
    result = await db.execute(
        select(ContentTemplate)
        .where(ContentTemplate.tenant_id == tenant_id)
        .order_by(ContentTemplate.is_favorite.desc(), ContentTemplate.created_at.desc())
    )
    return list(result.scalars().all())


async def get_template(
    db: AsyncSession, tenant_id: uuid.UUID, template_id: uuid.UUID
) -> ContentTemplate | None:
    result = await db.execute(
        select(ContentTemplate).where(
            ContentTemplate.id == template_id,
            ContentTemplate.tenant_id == tenant_id,
        )
    )
    return result.scalar_one_or_none()


async def create_template(
    db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, data: dict
) -> ContentTemplate:
    tpl = ContentTemplate(
        tenant_id=tenant_id,
        created_by=user_id,
        **data,
    )
    db.add(tpl)
    await db.commit()
    await db.refresh(tpl)
    return tpl


async def update_template(
    db: AsyncSession, tpl: ContentTemplate, patch: dict
) -> ContentTemplate:
    for k, v in patch.items():
        if v is not None:
            setattr(tpl, k, v)
    await db.commit()
    await db.refresh(tpl)
    return tpl


async def delete_template(db: AsyncSession, tpl: ContentTemplate) -> None:
    await db.delete(tpl)
    await db.commit()
