from __future__ import annotations

import uuid
from copy import deepcopy
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.db.models import BrandSettings, Tenant


async def _get_tenant(db: AsyncSession, tenant_id: uuid.UUID) -> Tenant:
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one()
    return tenant


async def _get_brand_settings(db: AsyncSession, tenant_id: uuid.UUID) -> BrandSettings | None:
    result = await db.execute(select(BrandSettings).where(BrandSettings.tenant_id == tenant_id))
    return result.scalar_one_or_none()


def _ensure_onboarding(config: dict[str, Any] | None) -> dict[str, Any]:
    cfg = deepcopy(config) if config else {}
    cfg.setdefault("onboarding", {})
    cfg["onboarding"].setdefault("step", 0)
    cfg["onboarding"].setdefault("completed", False)
    cfg["onboarding"].setdefault("channels", [])
    return cfg


async def get_onboarding_status(db: AsyncSession, tenant_id: uuid.UUID) -> dict[str, Any]:
    tenant = await _get_tenant(db, tenant_id)
    cfg = _ensure_onboarding(tenant.config)
    ob = cfg["onboarding"]

    brand = await _get_brand_settings(db, tenant_id)
    brand_voice: dict[str, Any] | None = None
    if brand is not None:
        brand_voice = {
            "tone": brand.tone,
            "colors": brand.colors or {},
            "fonts": brand.fonts or {},
            "logo_url": brand.logo_url,
            "forbidden_words": ob.get("forbidden_words", []),
        }

    return {
        "step": ob.get("step", 0),
        "completed": bool(ob.get("completed", False)),
        "business_profile": ob.get("business_profile"),
        "brand_voice": brand_voice,
        "channels": ob.get("channels", []),
    }


async def save_business_profile(
    db: AsyncSession, tenant_id: uuid.UUID, data: dict[str, Any]
) -> dict[str, Any]:
    tenant = await _get_tenant(db, tenant_id)
    cfg = _ensure_onboarding(tenant.config)
    cfg["onboarding"]["business_profile"] = data
    cfg["business_profile"] = data
    if cfg["onboarding"].get("step", 0) < 1:
        cfg["onboarding"]["step"] = 1
    tenant.config = cfg
    flag_modified(tenant, "config")
    await db.flush()
    return await get_onboarding_status(db, tenant_id)


async def save_brand_voice(
    db: AsyncSession, tenant_id: uuid.UUID, data: dict[str, Any]
) -> dict[str, Any]:
    tenant = await _get_tenant(db, tenant_id)
    brand = await _get_brand_settings(db, tenant_id)
    if brand is None:
        brand = BrandSettings(
            tenant_id=tenant_id,
            tone=data.get("tone"),
            colors=data.get("colors") or {},
            fonts=data.get("fonts") or {},
            logo_url=data.get("logo_url"),
        )
        db.add(brand)
    else:
        brand.tone = data.get("tone", brand.tone)
        brand.colors = data.get("colors") or {}
        brand.fonts = data.get("fonts") or {}
        brand.logo_url = data.get("logo_url", brand.logo_url)

    cfg = _ensure_onboarding(tenant.config)
    cfg["onboarding"]["forbidden_words"] = data.get("forbidden_words", []) or []
    cfg["onboarding"]["brand_voice"] = data
    if cfg["onboarding"].get("step", 0) < 2:
        cfg["onboarding"]["step"] = 2
    tenant.config = cfg
    flag_modified(tenant, "config")
    await db.flush()
    return await get_onboarding_status(db, tenant_id)


async def save_channels(
    db: AsyncSession, tenant_id: uuid.UUID, channels: list[str]
) -> dict[str, Any]:
    tenant = await _get_tenant(db, tenant_id)
    cfg = _ensure_onboarding(tenant.config)
    cfg["onboarding"]["channels"] = channels
    if cfg["onboarding"].get("step", 0) < 3:
        cfg["onboarding"]["step"] = 3
    tenant.config = cfg
    flag_modified(tenant, "config")
    await db.flush()
    return await get_onboarding_status(db, tenant_id)


async def mark_complete(db: AsyncSession, tenant_id: uuid.UUID) -> dict[str, Any]:
    tenant = await _get_tenant(db, tenant_id)
    cfg = _ensure_onboarding(tenant.config)
    cfg["onboarding"]["completed"] = True
    cfg["onboarding"]["step"] = 4
    tenant.config = cfg
    flag_modified(tenant, "config")
    await db.flush()
    return await get_onboarding_status(db, tenant_id)
