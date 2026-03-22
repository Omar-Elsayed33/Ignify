import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.db.models import Competitor, CompetitorSnapshot
from app.dependencies import CurrentUser, DbSession
from app.modules.competitors.schemas import (
    CompetitorCreate,
    CompetitorResponse,
    CompetitorSnapshotResponse,
    CompetitorUpdate,
)

router = APIRouter(prefix="/competitors", tags=["competitors"])


@router.get("/", response_model=list[CompetitorResponse])
async def list_competitors(user: CurrentUser, db: DbSession, skip: int = 0, limit: int = 50):
    result = await db.execute(
        select(Competitor)
        .where(Competitor.tenant_id == user.tenant_id)
        .order_by(Competitor.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/", response_model=CompetitorResponse, status_code=status.HTTP_201_CREATED)
async def create_competitor(data: CompetitorCreate, user: CurrentUser, db: DbSession):
    competitor = Competitor(
        tenant_id=user.tenant_id,
        name=data.name,
        website=data.website,
        description=data.description,
    )
    db.add(competitor)
    await db.flush()
    return competitor


@router.get("/{competitor_id}", response_model=CompetitorResponse)
async def get_competitor(competitor_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Competitor).where(Competitor.id == competitor_id, Competitor.tenant_id == user.tenant_id)
    )
    competitor = result.scalar_one_or_none()
    if not competitor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competitor not found")
    return competitor


@router.put("/{competitor_id}", response_model=CompetitorResponse)
async def update_competitor(competitor_id: uuid.UUID, data: CompetitorUpdate, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Competitor).where(Competitor.id == competitor_id, Competitor.tenant_id == user.tenant_id)
    )
    competitor = result.scalar_one_or_none()
    if not competitor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competitor not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(competitor, field, value)
    await db.flush()
    return competitor


@router.delete("/{competitor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_competitor(competitor_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Competitor).where(Competitor.id == competitor_id, Competitor.tenant_id == user.tenant_id)
    )
    competitor = result.scalar_one_or_none()
    if not competitor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competitor not found")
    await db.delete(competitor)
    await db.flush()


# ── Snapshots / Analysis ──


@router.get("/{competitor_id}/snapshots", response_model=list[CompetitorSnapshotResponse])
async def list_snapshots(competitor_id: uuid.UUID, user: CurrentUser, db: DbSession):
    comp_result = await db.execute(
        select(Competitor).where(Competitor.id == competitor_id, Competitor.tenant_id == user.tenant_id)
    )
    if not comp_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competitor not found")
    result = await db.execute(
        select(CompetitorSnapshot)
        .where(CompetitorSnapshot.competitor_id == competitor_id)
        .order_by(CompetitorSnapshot.created_at.desc())
    )
    return result.scalars().all()


@router.post("/{competitor_id}/analyze", response_model=CompetitorSnapshotResponse, status_code=status.HTTP_201_CREATED)
async def analyze_competitor(competitor_id: uuid.UUID, user: CurrentUser, db: DbSession):
    comp_result = await db.execute(
        select(Competitor).where(Competitor.id == competitor_id, Competitor.tenant_id == user.tenant_id)
    )
    competitor = comp_result.scalar_one_or_none()
    if not competitor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competitor not found")

    # In production, this would call AI analysis
    snapshot = CompetitorSnapshot(
        competitor_id=competitor_id,
        data={
            "analysis": f"Competitor analysis for {competitor.name}",
            "website": competitor.website,
            "status": "pending_ai_analysis",
        },
        snapshot_type="ai_analysis",
    )
    db.add(snapshot)
    await db.flush()
    return snapshot
