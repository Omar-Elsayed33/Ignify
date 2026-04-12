from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status

from app.dependencies import CurrentUser, DbSession
from app.modules.experiments.schemas import (
    ExperimentCreate,
    ExperimentDetail,
    ExperimentOut,
    TrackEvent,
    TrackResponse,
    WinnerResponse,
)
from app.modules.experiments.service import (
    complete_experiment,
    create_experiment,
    get_experiment,
    list_experiments,
    start_experiment,
    track_metric,
)

router = APIRouter(prefix="/experiments", tags=["experiments"])


@router.get("", response_model=list[ExperimentOut])
async def list_all(user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=403, detail="No tenant")
    return await list_experiments(db, user.tenant_id)


@router.post("", response_model=ExperimentDetail, status_code=status.HTTP_201_CREATED)
async def create(data: ExperimentCreate, user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=403, detail="No tenant")
    try:
        exp = await create_experiment(db, user.tenant_id, user.id, data.model_dump())
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Failed to create experiment: {e}")
    return exp


@router.get("/{experiment_id}", response_model=ExperimentDetail)
async def detail(experiment_id: uuid.UUID, user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=403, detail="No tenant")
    exp = await get_experiment(db, user.tenant_id, experiment_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return exp


@router.post("/{experiment_id}/start", response_model=ExperimentOut)
async def start(experiment_id: uuid.UUID, user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=403, detail="No tenant")
    exp = await get_experiment(db, user.tenant_id, experiment_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return await start_experiment(db, exp)


@router.post("/{experiment_id}/complete", response_model=WinnerResponse)
async def complete(experiment_id: uuid.UUID, user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=403, detail="No tenant")
    exp = await get_experiment(db, user.tenant_id, experiment_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    completed = await complete_experiment(db, user.tenant_id, exp)
    return WinnerResponse(
        experiment_id=completed.id,
        winner_variant_id=completed.winner_variant_id,
        status=completed.status.value if hasattr(completed.status, "value") else str(completed.status),
    )


@router.post("/{experiment_id}/track", response_model=TrackResponse)
async def track(
    experiment_id: uuid.UUID, event: TrackEvent, user: CurrentUser, db: DbSession
):
    if not user.tenant_id:
        raise HTTPException(status_code=403, detail="No tenant")
    exp = await get_experiment(db, user.tenant_id, experiment_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    row = await track_metric(db, user.tenant_id, event.variant_id, event.metric, event.value)
    if not row:
        raise HTTPException(status_code=404, detail="Variant not found")
    return TrackResponse(
        variant_id=row.id,
        metric=event.metric,
        new_value=int(getattr(row, event.metric, 0) or 0),
    )
