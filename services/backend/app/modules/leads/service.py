"""Leads CRM service — Kanban, CRUD, activities, and auto-create from inbox."""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Lead, LeadActivity, LeadSource, LeadStatus
from app.modules.leads.schemas import (
    LeadActivityCreate,
    LeadCreate,
    LeadKanbanColumn,
    LeadResponse,
    LeadUpdate,
)


STAGES: list[str] = ["new", "contacted", "qualified", "proposal", "won", "lost"]


def _to_response(lead: Lead, activities_count: int = 0) -> LeadResponse:
    return LeadResponse(
        id=lead.id,
        tenant_id=lead.tenant_id,
        name=lead.name,
        email=lead.email,
        phone=lead.phone,
        company=lead.company,
        source=lead.source,
        score=lead.score,
        status=lead.status,
        assigned_to=lead.assigned_to,
        metadata=lead.metadata_ or {},
        activities_count=activities_count,
        created_at=lead.created_at,
        updated_at=lead.updated_at,
    )


async def _activity_counts(db: AsyncSession, lead_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not lead_ids:
        return {}
    rows = (
        await db.execute(
            select(LeadActivity.lead_id, func.count(LeadActivity.id))
            .where(LeadActivity.lead_id.in_(lead_ids))
            .group_by(LeadActivity.lead_id)
        )
    ).all()
    return {lid: cnt for lid, cnt in rows}


async def list_by_stage(db: AsyncSession, tenant_id: uuid.UUID) -> list[LeadKanbanColumn]:
    result = await db.execute(
        select(Lead)
        .where(Lead.tenant_id == tenant_id)
        .order_by(Lead.updated_at.desc())
    )
    leads = list(result.scalars().all())
    counts = await _activity_counts(db, [l.id for l in leads])

    by_stage: dict[str, list[LeadResponse]] = {s: [] for s in STAGES}
    for l in leads:
        stage = l.status.value if hasattr(l.status, "value") else str(l.status)
        if stage not in by_stage:
            by_stage[stage] = []
        by_stage[stage].append(_to_response(l, counts.get(l.id, 0)))

    return [LeadKanbanColumn(stage=s, leads=by_stage.get(s, [])) for s in STAGES]


async def create_lead(
    db: AsyncSession, tenant_id: uuid.UUID, data: LeadCreate
) -> Lead:
    meta = dict(data.metadata or {})
    if data.notes:
        meta["notes"] = data.notes
    lead = Lead(
        tenant_id=tenant_id,
        name=data.name,
        email=data.email,
        phone=data.phone,
        company=data.company,
        source=data.source,
        score=data.score,
        status=data.status,
        assigned_to=data.assigned_to,
        metadata_=meta,
    )
    db.add(lead)
    await db.flush()
    if data.notes:
        db.add(
            LeadActivity(
                lead_id=lead.id,
                activity_type="note",
                description=data.notes,
            )
        )
        await db.flush()
    await db.commit()
    await db.refresh(lead)
    return lead


async def update_lead(
    db: AsyncSession, tenant_id: uuid.UUID, lead_id: uuid.UUID, data: LeadUpdate
) -> Lead | None:
    lead = (
        await db.execute(
            select(Lead).where(Lead.id == lead_id, Lead.tenant_id == tenant_id)
        )
    ).scalar_one_or_none()
    if not lead:
        return None

    payload = data.model_dump(exclude_unset=True)
    # Normalize aliases
    if "stage" in payload and payload["stage"] is not None:
        payload["status"] = payload.pop("stage")
    else:
        payload.pop("stage", None)
    if "owner_id" in payload and payload["owner_id"] is not None:
        payload["assigned_to"] = payload.pop("owner_id")
    else:
        payload.pop("owner_id", None)

    notes = payload.pop("notes", None)
    metadata = payload.pop("metadata", None)

    for field, value in payload.items():
        setattr(lead, field, value)
    if metadata is not None:
        lead.metadata_ = metadata
    if notes:
        meta = dict(lead.metadata_ or {})
        meta["notes"] = notes
        lead.metadata_ = meta
        db.add(
            LeadActivity(
                lead_id=lead.id, activity_type="note", description=notes
            )
        )

    await db.flush()
    await db.commit()
    await db.refresh(lead)
    return lead


async def move_stage(
    db: AsyncSession, tenant_id: uuid.UUID, lead_id: uuid.UUID, stage: str
) -> Lead | None:
    lead = (
        await db.execute(
            select(Lead).where(Lead.id == lead_id, Lead.tenant_id == tenant_id)
        )
    ).scalar_one_or_none()
    if not lead:
        return None
    old_stage = lead.status.value if hasattr(lead.status, "value") else str(lead.status)
    try:
        new_status = LeadStatus(stage)
    except ValueError:
        return None
    lead.status = new_status
    db.add(
        LeadActivity(
            lead_id=lead.id,
            activity_type="stage_change",
            description=f"{old_stage} -> {stage}",
        )
    )
    await db.flush()
    await db.commit()
    await db.refresh(lead)
    return lead


async def add_activity(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    lead_id: uuid.UUID,
    data: LeadActivityCreate,
    created_by: uuid.UUID | None = None,
) -> LeadActivity | None:
    lead = (
        await db.execute(
            select(Lead).where(Lead.id == lead_id, Lead.tenant_id == tenant_id)
        )
    ).scalar_one_or_none()
    if not lead:
        return None
    atype = data.activity_type or data.type or "note"
    content = data.content or data.description
    activity = LeadActivity(
        lead_id=lead.id,
        activity_type=atype,
        description=content,
        created_by=created_by,
    )
    db.add(activity)
    await db.flush()
    await db.commit()
    await db.refresh(activity)
    return activity


async def list_activities(
    db: AsyncSession, tenant_id: uuid.UUID, lead_id: uuid.UUID
) -> list[LeadActivity]:
    lead = (
        await db.execute(
            select(Lead).where(Lead.id == lead_id, Lead.tenant_id == tenant_id)
        )
    ).scalar_one_or_none()
    if not lead:
        return []
    rows = (
        await db.execute(
            select(LeadActivity)
            .where(LeadActivity.lead_id == lead_id)
            .order_by(LeadActivity.created_at.desc())
        )
    ).scalars().all()
    return list(rows)


async def get_lead(
    db: AsyncSession, tenant_id: uuid.UUID, lead_id: uuid.UUID
) -> Lead | None:
    return (
        await db.execute(
            select(Lead).where(Lead.id == lead_id, Lead.tenant_id == tenant_id)
        )
    ).scalar_one_or_none()


async def delete_lead(
    db: AsyncSession, tenant_id: uuid.UUID, lead_id: uuid.UUID
) -> bool:
    lead = await get_lead(db, tenant_id, lead_id)
    if not lead:
        return False
    # remove activities first
    acts = (
        await db.execute(select(LeadActivity).where(LeadActivity.lead_id == lead.id))
    ).scalars().all()
    for a in acts:
        await db.delete(a)
    await db.delete(lead)
    await db.commit()
    return True


# ── Auto-create from inbox conversation ──


def _source_from_channel(channel_type: str | None) -> LeadSource:
    if not channel_type:
        return LeadSource.manual
    ct = channel_type.lower()
    if "whatsapp" in ct:
        return LeadSource.whatsapp
    if "instagram" in ct:
        return LeadSource.instagram
    if "messenger" in ct or "facebook" in ct:
        return LeadSource.messenger
    if "web" in ct:
        return LeadSource.website
    return LeadSource.manual


async def auto_create_from_conversation(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    conversation_id: uuid.UUID,
    customer_name: str | None = None,
    customer_phone: str | None = None,
    customer_email: str | None = None,
    source: str | None = None,
) -> Lead | None:
    """Idempotently create a lead from a conversation's customer info.

    Returns the existing or newly-created Lead, or None if no useful info.
    """
    if not (customer_name or customer_phone or customer_email):
        return None

    # De-duplicate by conversation_id stored in metadata, or by phone/email.
    query = select(Lead).where(Lead.tenant_id == tenant_id)
    existing = None
    if customer_phone:
        existing = (
            await db.execute(query.where(Lead.phone == customer_phone))
        ).scalars().first()
    if not existing and customer_email:
        existing = (
            await db.execute(query.where(Lead.email == customer_email))
        ).scalars().first()
    if existing:
        # link the conversation if not already linked
        meta = dict(existing.metadata_ or {})
        convs = meta.get("conversation_ids") or []
        cid = str(conversation_id)
        if cid not in convs:
            convs.append(cid)
            meta["conversation_ids"] = convs
            existing.metadata_ = meta
            await db.flush()
            await db.commit()
        return existing

    lead_source = _source_from_channel(source)
    lead = Lead(
        tenant_id=tenant_id,
        name=customer_name or customer_phone or customer_email or "Unknown",
        phone=customer_phone,
        email=customer_email,
        source=lead_source,
        status=LeadStatus.new,
        metadata_={"conversation_ids": [str(conversation_id)], "auto_created": True},
    )
    db.add(lead)
    await db.flush()
    db.add(
        LeadActivity(
            lead_id=lead.id,
            activity_type="message",
            description=f"Auto-created from {lead_source.value} conversation",
        )
    )
    await db.flush()
    await db.commit()
    await db.refresh(lead)
    return lead


async def link_conversation_to_lead(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    conversation_id: uuid.UUID,
    customer_name: str | None = None,
    customer_phone: str | None = None,
    customer_email: str | None = None,
    source: str | None = None,
) -> Lead | None:
    return await auto_create_from_conversation(
        db,
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        customer_name=customer_name,
        customer_phone=customer_phone,
        customer_email=customer_email,
        source=source,
    )


async def qualify_lead(
    db: AsyncSession, tenant_id: uuid.UUID, lead_id: uuid.UUID
) -> dict[str, Any] | None:
    """Run the LeadAgent qualifier and persist score + note activity."""
    from app.agents.registry import get_agent  # local import to avoid cycles

    lead = await get_lead(db, tenant_id, lead_id)
    if not lead:
        return None

    # Collect a bit of history (recent activities) to give the qualifier context
    acts = (
        await db.execute(
            select(LeadActivity)
            .where(LeadActivity.lead_id == lead.id)
            .order_by(LeadActivity.created_at.desc())
            .limit(10)
        )
    ).scalars().all()
    history = [
        {"type": a.activity_type, "content": a.description or ""} for a in acts
    ]

    agent = get_agent("lead", str(tenant_id))
    result = await agent.run(
        {
            "tenant_id": str(tenant_id),
            "lead": {
                "name": lead.name,
                "phone": lead.phone,
                "email": lead.email,
                "notes": (lead.metadata_ or {}).get("notes"),
                "source": lead.source.value if hasattr(lead.source, "value") else str(lead.source),
                "status": lead.status.value if hasattr(lead.status, "value") else str(lead.status),
                "history": history,
            },
            "score": None,
            "qualification": None,
            "next_action": None,
            "meta": {},
        },
        thread_id=f"lead:{lead.id}",
    )

    score = result.get("score")
    qualification = result.get("qualification")
    next_action = result.get("next_action")

    if isinstance(score, (int, float)):
        lead.score = int(score)
    db.add(
        LeadActivity(
            lead_id=lead.id,
            activity_type="note",
            description=(
                f"AI qualification: {qualification} (score: {score}). "
                f"Next action: {next_action}"
            ),
        )
    )
    await db.flush()
    await db.commit()
    await db.refresh(lead)

    return {
        "score": int(score) if isinstance(score, (int, float)) else 0,
        "qualification": str(qualification or "cold"),
        "next_action": next_action,
    }
