from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status

from app.core.rate_limit_presets import LOOSE, MEDIUM
from app.dependencies import CurrentUser, DbSession
from app.modules.content_templates.schemas import (
    ContentTemplateCreate,
    ContentTemplateResponse,
    ContentTemplateUpdate,
)
from app.modules.content_templates.service import (
    create_template,
    delete_template,
    get_template,
    list_templates,
    update_template,
)

router = APIRouter(prefix="/content-templates", tags=["content-templates"])


@router.get("", response_model=list[ContentTemplateResponse])
async def list_all(user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=403, detail="No tenant")
    return await list_templates(db, user.tenant_id)


@router.post(
    "",
    response_model=ContentTemplateResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[MEDIUM],
)
async def create(data: ContentTemplateCreate, user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=403, detail="No tenant")
    return await create_template(db, user.tenant_id, user.id, data.model_dump())


@router.get("/{template_id}", response_model=ContentTemplateResponse)
async def get_one(template_id: uuid.UUID, user: CurrentUser, db: DbSession):
    tpl = await get_template(db, user.tenant_id, template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return tpl


@router.patch(
    "/{template_id}",
    response_model=ContentTemplateResponse,
    dependencies=[MEDIUM],
)
async def patch_one(
    template_id: uuid.UUID,
    data: ContentTemplateUpdate,
    user: CurrentUser,
    db: DbSession,
):
    tpl = await get_template(db, user.tenant_id, template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return await update_template(db, tpl, data.model_dump(exclude_unset=True))


@router.delete(
    "/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[LOOSE],
)
async def delete_one(template_id: uuid.UUID, user: CurrentUser, db: DbSession):
    tpl = await get_template(db, user.tenant_id, template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    await delete_template(db, tpl)


@router.post(
    "/{template_id}/use",
    response_model=ContentTemplateResponse,
    dependencies=[LOOSE],
)
async def use_template(template_id: uuid.UUID, user: CurrentUser, db: DbSession):
    tpl = await get_template(db, user.tenant_id, template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return tpl
