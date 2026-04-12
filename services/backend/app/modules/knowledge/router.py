from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status

from app.core.rate_limit_presets import LOOSE, MEDIUM, STRICT
from app.dependencies import CurrentUser, DbSession
from app.modules.knowledge import service
from app.modules.knowledge.schemas import (
    BulkImportRequest,
    BulkImportResponse,
    KnowledgeChunkCreate,
    KnowledgeChunkResponse,
    KnowledgeChunkUpdate,
    SearchHit,
    SearchRequest,
    SearchResponse,
)

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


@router.get("", response_model=list[KnowledgeChunkResponse])
async def list_all(user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=403, detail="No tenant")
    rows = await service.list_chunks(db, user.tenant_id)
    return [service.to_response_dict(r) for r in rows]


@router.post(
    "",
    response_model=KnowledgeChunkResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[MEDIUM],
)
async def create(data: KnowledgeChunkCreate, user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=403, detail="No tenant")
    chunk = await service.create_chunk(
        db,
        user.tenant_id,
        title=data.title,
        content=data.content,
        source=data.source,
        metadata=data.metadata,
    )
    return service.to_response_dict(chunk)


@router.patch(
    "/{chunk_id}",
    response_model=KnowledgeChunkResponse,
    dependencies=[MEDIUM],
)
async def update(
    chunk_id: uuid.UUID,
    data: KnowledgeChunkUpdate,
    user: CurrentUser,
    db: DbSession,
):
    if not user.tenant_id:
        raise HTTPException(status_code=403, detail="No tenant")
    chunk = await service.update_chunk(
        db, user.tenant_id, chunk_id, data.model_dump(exclude_unset=True)
    )
    if not chunk:
        raise HTTPException(status_code=404, detail="Chunk not found")
    return service.to_response_dict(chunk)


@router.delete(
    "/{chunk_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[LOOSE],
)
async def delete(chunk_id: uuid.UUID, user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=403, detail="No tenant")
    ok = await service.delete_chunk(db, user.tenant_id, chunk_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Chunk not found")


@router.post(
    "/bulk-import",
    response_model=BulkImportResponse,
    dependencies=[STRICT],
)
async def bulk_import(data: BulkImportRequest, user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=403, detail="No tenant")
    items = [c.model_dump() for c in data.chunks]
    n = await service.bulk_create(db, user.tenant_id, items)
    return BulkImportResponse(inserted=n)


@router.post(
    "/search",
    response_model=SearchResponse,
    dependencies=[MEDIUM],
)
async def search_kb(data: SearchRequest, user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=403, detail="No tenant")
    results = await service.search(db, user.tenant_id, data.query, data.top_k)
    hits = [
        SearchHit(**{**service.to_response_dict(c), "score": score})
        for c, score in results
    ]
    return SearchResponse(hits=hits)
