"""Service for website lead capture. Uses a dedicated 'ignify-platform' tenant."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Lead, LeadActivity, LeadSource, LeadStatus, Tenant
from app.modules.public_leads.schemas import PublicLeadCreate


PLATFORM_SLUG = "ignify-platform"


async def _get_or_create_platform_tenant(db: AsyncSession) -> Tenant:
    result = await db.execute(select(Tenant).where(Tenant.slug == PLATFORM_SLUG))
    tenant = result.scalar_one_or_none()
    if tenant:
        return tenant
    # fall back to first tenant if exists, else create
    fallback = (await db.execute(select(Tenant).limit(1))).scalar_one_or_none()
    if fallback:
        return fallback
    tenant = Tenant(name="Ignify Platform", slug=PLATFORM_SLUG, is_active=True)
    db.add(tenant)
    await db.flush()
    await db.commit()
    await db.refresh(tenant)
    return tenant


async def create_public_lead(
    db: AsyncSession, data: PublicLeadCreate
) -> Lead:
    tenant = await _get_or_create_platform_tenant(db)
    metadata = {
        "topic": data.topic,
        "message": data.message,
        "source_url": "website",
    }
    lead = Lead(
        tenant_id=tenant.id,
        name=data.name,
        email=data.email,
        phone=data.phone,
        company=data.company,
        source=LeadSource.website,
        status=LeadStatus.new,
        metadata_=metadata,
    )
    db.add(lead)
    await db.flush()
    db.add(
        LeadActivity(
            lead_id=lead.id,
            activity_type="note",
            description=f"[{data.topic}] {data.message}",
        )
    )
    await db.flush()
    await db.commit()
    await db.refresh(lead)
    return lead
