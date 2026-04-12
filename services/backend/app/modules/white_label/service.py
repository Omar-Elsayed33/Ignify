"""White-label service with Agency-plan gating."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import BrandSettings, Plan, Tenant


EXPECTED_CNAME = "ignify.app"


async def _get_tenant_with_plan(db: AsyncSession, tenant_id: uuid.UUID) -> Tenant | None:
    result = await db.execute(
        select(Tenant).options(selectinload(Tenant.plan)).where(Tenant.id == tenant_id)
    )
    return result.scalar_one_or_none()


def _plan_code(plan: Plan | None) -> str | None:
    if not plan:
        return None
    # Plan model uses `slug`; treat slug as the code.
    return getattr(plan, "slug", None)


def _is_agency(plan: Plan | None) -> bool:
    return (_plan_code(plan) or "").lower() == "agency"


async def get_or_create_brand(db: AsyncSession, tenant_id: uuid.UUID) -> BrandSettings:
    existing = (
        await db.execute(select(BrandSettings).where(BrandSettings.tenant_id == tenant_id))
    ).scalar_one_or_none()
    if existing:
        return existing
    created = BrandSettings(tenant_id=tenant_id)
    db.add(created)
    await db.commit()
    await db.refresh(created)
    return created


async def get_settings(db: AsyncSession, tenant_id: uuid.UUID) -> dict[str, Any]:
    tenant = await _get_tenant_with_plan(db, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    is_agency = _is_agency(tenant.plan)
    brand = await get_or_create_brand(db, tenant_id)

    return {
        "white_label_enabled": bool(brand.white_label_enabled),
        "custom_domain": brand.custom_domain,
        "custom_domain_verified": bool(brand.custom_domain_verified),
        "app_name": brand.app_name,
        "logo_url": brand.logo_url,
        "favicon_url": brand.favicon_url,
        "colors": brand.colors or {},
        "email_sender_name": brand.email_sender_name,
        "email_sender_address": brand.email_sender_address,
        "footer_text": brand.footer_text,
        "support_email": brand.support_email,
        "support_url": brand.support_url,
        "hide_powered_by": bool(brand.hide_powered_by),
        "plan_code": _plan_code(tenant.plan),
        "is_agency": is_agency,
    }


async def update_settings(
    db: AsyncSession, tenant_id: uuid.UUID, patch: dict[str, Any]
) -> dict[str, Any]:
    tenant = await _get_tenant_with_plan(db, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    is_agency = _is_agency(tenant.plan)

    # Enforce gating: white_label_enabled can only be True for agency tier.
    if patch.get("white_label_enabled") is True and not is_agency:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="White-label is only available on the Agency plan.",
        )

    brand = await get_or_create_brand(db, tenant_id)

    # If not agency, still allow updating cosmetic fields but force the gated
    # flags back to safe values.
    for key, value in patch.items():
        if value is None:
            continue
        if hasattr(brand, key):
            setattr(brand, key, value)

    if not is_agency:
        brand.white_label_enabled = False
        brand.hide_powered_by = False

    # Reset verification if domain changed
    if "custom_domain" in patch:
        brand.custom_domain_verified = False

    await db.commit()
    await db.refresh(brand)
    return await get_settings(db, tenant_id)


async def verify_domain(
    db: AsyncSession, tenant_id: uuid.UUID, domain: str
) -> dict[str, Any]:
    tenant = await _get_tenant_with_plan(db, tenant_id)
    if not tenant or not _is_agency(tenant.plan):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Custom domains require the Agency plan.",
        )
    brand = await get_or_create_brand(db, tenant_id)
    brand.custom_domain = domain.strip().lower()
    brand.custom_domain_verified = False  # stub: mark pending; cron verifies
    await db.commit()
    await db.refresh(brand)
    return {
        "domain": brand.custom_domain,
        "status": "verified" if brand.custom_domain_verified else "pending",
        "expected_cname": EXPECTED_CNAME,
    }


async def find_tenant_by_domain(
    db: AsyncSession, host: str
) -> uuid.UUID | None:
    """Public lookup used by custom-domain middleware."""
    if not host:
        return None
    norm = host.strip().lower().split(":")[0]
    row = (
        await db.execute(
            select(BrandSettings).where(
                BrandSettings.custom_domain == norm,
                BrandSettings.white_label_enabled.is_(True),
            )
        )
    ).scalar_one_or_none()
    return row.tenant_id if row else None
