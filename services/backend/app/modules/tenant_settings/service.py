from __future__ import annotations

import uuid
from copy import deepcopy
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.db.models import BrandSettings, Competitor, Tenant
from app.modules.onboarding.service import (
    save_business_profile as _save_business_profile,
    save_channels as _save_channels,
)


async def sync_competitors_to_profile(
    db: AsyncSession, tenant_id: uuid.UUID
) -> list[str]:
    """Read the Competitor DB rows and mirror their names into
    tenant.config.business_profile.competitors. Returns the final list."""
    result = await db.execute(
        select(Competitor).where(Competitor.tenant_id == tenant_id)
    )
    names = [c.name for c in result.scalars().all() if c.name]

    tenant = await _get_tenant(db, tenant_id)
    cfg = deepcopy(tenant.config or {})
    bp = cfg.setdefault("business_profile", {})
    bp["competitors"] = names
    ob = cfg.setdefault("onboarding", {})
    ob_bp = ob.setdefault("business_profile", {})
    ob_bp["competitors"] = names
    tenant.config = cfg
    flag_modified(tenant, "config")
    await db.flush()
    return names


async def sync_profile_to_competitors(
    db: AsyncSession, tenant_id: uuid.UUID, names: list[str]
) -> None:
    """For every name in the business profile that isn't yet a Competitor row,
    create a minimal row. Doesn't delete rows — deletion flows through the
    /competitors endpoints explicitly."""
    clean = [n.strip() for n in names if isinstance(n, str) and n.strip()]
    if not clean:
        return
    result = await db.execute(
        select(Competitor).where(Competitor.tenant_id == tenant_id)
    )
    existing = {c.name.lower(): c for c in result.scalars().all() if c.name}
    for name in clean:
        if name.lower() in existing:
            continue
        db.add(Competitor(tenant_id=tenant_id, name=name))
    await db.flush()


async def _get_tenant(db: AsyncSession, tenant_id: uuid.UUID) -> Tenant:
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    return result.scalar_one()


async def _get_brand(db: AsyncSession, tenant_id: uuid.UUID) -> BrandSettings | None:
    result = await db.execute(
        select(BrandSettings).where(BrandSettings.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


def _pick_business_profile(cfg: dict[str, Any] | None) -> dict[str, Any]:
    """Pick the business_profile from tenant.config, preferring whichever
    copy has more populated fields (flat vs onboarding.business_profile)."""
    cfg = cfg or {}
    flat = cfg.get("business_profile") or {}
    nested = (cfg.get("onboarding") or {}).get("business_profile") or {}

    def score(d: dict[str, Any]) -> int:
        return sum(1 for v in d.values() if v not in (None, "", [], {}))

    return flat if score(flat) >= score(nested) else nested


async def get_business_profile(
    db: AsyncSession, tenant_id: uuid.UUID
) -> dict[str, Any]:
    tenant = await _get_tenant(db, tenant_id)
    bp = _pick_business_profile(tenant.config)
    # Ensure expected keys exist
    return {
        "industry": bp.get("industry"),
        "country": bp.get("country"),
        "primary_language": bp.get("primary_language", "en"),
        "description": bp.get("description"),
        "target_audience": bp.get("target_audience"),
        "products": bp.get("products") or [],
        "competitors": bp.get("competitors") or [],
        "website": bp.get("website"),
        "business_name": bp.get("business_name"),
        "phone": bp.get("phone"),
        "business_email": bp.get("business_email"),
    }


async def update_business_profile(
    db: AsyncSession, tenant_id: uuid.UUID, data: dict[str, Any]
) -> dict[str, Any]:
    await _save_business_profile(db, tenant_id, data)
    # Mirror competitor names into the Competitor DB table so the
    # /competitors page stays in sync with the business profile.
    names = data.get("competitors") or []
    if isinstance(names, list):
        await sync_profile_to_competitors(db, tenant_id, names)
    return await get_business_profile(db, tenant_id)


async def get_brand(db: AsyncSession, tenant_id: uuid.UUID) -> dict[str, Any]:
    tenant = await _get_tenant(db, tenant_id)
    brand = await _get_brand(db, tenant_id)
    ob = (tenant.config or {}).get("onboarding") or {}
    forbidden = ob.get("forbidden_words", []) or []

    if brand is None:
        return {
            "brand_name": None,
            "brand_voice": None,
            "tone": None,
            "colors": {},
            "fonts": {},
            "logo_url": None,
            "forbidden_words": forbidden,
            "white_label_enabled": False,
            "custom_domain": None,
            "custom_domain_verified": False,
            "app_name": None,
            "favicon_url": None,
            "email_sender_name": None,
            "email_sender_address": None,
            "footer_text": None,
            "support_email": None,
            "support_url": None,
            "hide_powered_by": False,
        }

    return {
        "brand_name": brand.brand_name,
        "brand_voice": brand.brand_voice,
        "tone": brand.tone,
        "colors": brand.colors or {},
        "fonts": brand.fonts or {},
        "logo_url": brand.logo_url,
        "forbidden_words": forbidden,
        "white_label_enabled": bool(brand.white_label_enabled),
        "custom_domain": brand.custom_domain,
        "custom_domain_verified": bool(brand.custom_domain_verified),
        "app_name": brand.app_name,
        "favicon_url": brand.favicon_url,
        "email_sender_name": brand.email_sender_name,
        "email_sender_address": brand.email_sender_address,
        "footer_text": brand.footer_text,
        "support_email": brand.support_email,
        "support_url": brand.support_url,
        "hide_powered_by": bool(brand.hide_powered_by),
    }


async def update_brand(
    db: AsyncSession, tenant_id: uuid.UUID, data: dict[str, Any]
) -> dict[str, Any]:
    tenant = await _get_tenant(db, tenant_id)
    brand = await _get_brand(db, tenant_id)
    if brand is None:
        brand = BrandSettings(tenant_id=tenant_id)
        db.add(brand)

    # Only update fields that were provided (not None)
    simple_fields = [
        "brand_name",
        "brand_voice",
        "tone",
        "logo_url",
        "custom_domain",
        "app_name",
        "favicon_url",
        "email_sender_name",
        "email_sender_address",
        "footer_text",
        "support_email",
        "support_url",
    ]
    for f in simple_fields:
        if f in data and data[f] is not None:
            setattr(brand, f, data[f])

    if "colors" in data and data["colors"] is not None:
        brand.colors = data["colors"] or {}
    if "fonts" in data and data["fonts"] is not None:
        brand.fonts = data["fonts"] or {}
    for bf in ("white_label_enabled", "hide_powered_by"):
        if bf in data and data[bf] is not None:
            setattr(brand, bf, bool(data[bf]))

    # Forbidden words live in tenant.config.onboarding.forbidden_words
    if "forbidden_words" in data and data["forbidden_words"] is not None:
        cfg = deepcopy(tenant.config or {})
        cfg.setdefault("onboarding", {})
        cfg["onboarding"]["forbidden_words"] = list(data["forbidden_words"])
        tenant.config = cfg
        flag_modified(tenant, "config")

    await db.flush()
    return await get_brand(db, tenant_id)


async def get_workflow(db: AsyncSession, tenant_id: uuid.UUID) -> dict[str, Any]:
    tenant = await _get_tenant(db, tenant_id)
    wf = (tenant.config or {}).get("workflow") or {}
    return {"approval_required": bool(wf.get("approval_required", False))}


async def update_workflow(
    db: AsyncSession, tenant_id: uuid.UUID, approval_required: bool
) -> dict[str, Any]:
    tenant = await _get_tenant(db, tenant_id)
    cfg = deepcopy(tenant.config or {})
    cfg.setdefault("workflow", {})["approval_required"] = bool(approval_required)
    tenant.config = cfg
    flag_modified(tenant, "config")
    await db.flush()
    return {"approval_required": bool(approval_required)}


async def get_channels(db: AsyncSession, tenant_id: uuid.UUID) -> list[str]:
    tenant = await _get_tenant(db, tenant_id)
    ob = (tenant.config or {}).get("onboarding") or {}
    return list(ob.get("channels", []) or [])


async def update_channels(
    db: AsyncSession, tenant_id: uuid.UUID, channels: list[str]
) -> list[str]:
    await _save_channels(db, tenant_id, channels)
    return await get_channels(db, tenant_id)


async def get_all(db: AsyncSession, tenant_id: uuid.UUID) -> dict[str, Any]:
    return {
        "business_profile": await get_business_profile(db, tenant_id),
        "brand": await get_brand(db, tenant_id),
        "channels": await get_channels(db, tenant_id),
    }
