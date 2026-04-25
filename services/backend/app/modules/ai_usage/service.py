"""AI usage service: provisioning, syncing, and querying per-tenant OpenRouter usage."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import decrypt_token, encrypt_token
from app.core.openrouter_provisioning import (
    delete_key,
    get_key_usage,
    limit_for_plan,
    provision_key,
    update_key_limit,
)
from app.db.models import Plan, Tenant, TenantOpenRouterConfig
from app.modules.ai_usage.schemas import AIUsageResponse, AdminAIUsageResponse, AdminTenantAIUsageRow


async def provision_tenant_ai_key(db: AsyncSession, tenant: Tenant, plan: Optional[Plan]) -> TenantOpenRouterConfig:
    """Create a tenant's OpenRouter sub-key if they don't have one yet.

    Safe to call multiple times — skips provisioning if key already exists.
    """
    plan_slug = plan.slug if plan else None
    result = await db.execute(select(TenantOpenRouterConfig).where(TenantOpenRouterConfig.tenant_id == tenant.id))
    config = result.scalar_one_or_none()

    limit = limit_for_plan(plan_slug)
    reset_at = _next_reset()

    if config is None:
        config = TenantOpenRouterConfig(
            tenant_id=tenant.id,
            monthly_limit_usd=limit,
            reset_at=reset_at,
        )
        db.add(config)

    # Only call the provisioning API if no key is stored yet.
    # Phase 12: pass db so provision_key reads the manager key from the
    # DB-stored admin setting first (env var fallback). Lets ops rotate
    # the manager key from /admin without a redeploy.
    if not config.openrouter_key_encrypted:
        provisioned = await provision_key(str(tenant.id), tenant.name, plan_slug, db=db)
        if provisioned.get("key"):
            config.openrouter_key_encrypted = encrypt_token(provisioned["key"])
            config.openrouter_key_id = provisioned["key_id"]
            config.monthly_limit_usd = limit
            config.reset_at = reset_at

    await db.flush()
    return config


async def get_tenant_usage(db: AsyncSession, tenant_id: uuid.UUID) -> AIUsageResponse:
    result = await db.execute(select(TenantOpenRouterConfig).where(TenantOpenRouterConfig.tenant_id == tenant_id))
    config = result.scalar_one_or_none()

    if config is None:
        return AIUsageResponse(
            monthly_limit_usd=2.50,
            usage_usd=0.0,
            remaining_usd=2.50,
            usage_pct=0.0,
            reset_at=None,
            usage_synced_at=None,
            has_key=False,
            soft_warning=False,
            blocked=False,
            deep_runs_this_month=0,
            deep_runs_cap=10,
        )

    limit = float(config.monthly_limit_usd)
    usage = float(config.usage_usd)
    remaining = max(0.0, limit - usage)
    pct_ratio = (usage / limit) if limit > 0 else 0.0
    pct = round(pct_ratio * 100, 1)

    # Phase 5 P1: include gate flags + deep-run counter for frontend banners.
    from app.core.ai_budget import (
        DEEP_MODE_MONTHLY_CAP,
        SOFT_WARNING_THRESHOLD,
        _deep_runs_this_month,
    )
    deep_runs = await _deep_runs_this_month(db, tenant_id)

    return AIUsageResponse(
        monthly_limit_usd=limit,
        usage_usd=usage,
        remaining_usd=remaining,
        usage_pct=pct,
        reset_at=config.reset_at,
        usage_synced_at=config.usage_synced_at,
        has_key=bool(config.openrouter_key_encrypted),
        soft_warning=pct_ratio >= SOFT_WARNING_THRESHOLD,
        blocked=remaining <= 0,
        deep_runs_this_month=deep_runs,
        deep_runs_cap=DEEP_MODE_MONTHLY_CAP,
    )


async def sync_tenant_usage(db: AsyncSession, config: TenantOpenRouterConfig) -> None:
    """Pull latest usage from OpenRouter and persist it."""
    if not config.openrouter_key_id:
        return
    data = await get_key_usage(config.openrouter_key_id)
    if not data:
        return
    config.usage_usd = data["usage"]
    config.usage_synced_at = datetime.now(timezone.utc)
    await db.flush()


async def update_tenant_plan_limit(db: AsyncSession, tenant_id: uuid.UUID, plan_slug: str) -> None:
    """Sync a tenant's monthly AI budget with their plan's `ai_budget_usd`.

    Phase 7 P1: called on every plan assignment / subscription approval /
    tier change. Previously this bailed out silently if no
    `TenantOpenRouterConfig` row existed, which left newly-approved tenants
    with no budget config at all. Now we create the row on demand.

    This function is idempotent and safe to call multiple times.
    """
    result = await db.execute(
        select(TenantOpenRouterConfig).where(TenantOpenRouterConfig.tenant_id == tenant_id)
    )
    config = result.scalar_one_or_none()
    new_limit = limit_for_plan(plan_slug)
    if config is None:
        # Tenant has no AI config yet (fresh tenant, or config never
        # auto-provisioned). Create a row so the check() gate has something
        # to read against on the next AI action.
        config = TenantOpenRouterConfig(
            tenant_id=tenant_id,
            monthly_limit_usd=new_limit,
        )
        db.add(config)
    else:
        config.monthly_limit_usd = new_limit
    if config.openrouter_key_id:
        # Update the remote OpenRouter sub-key limit to match.
        await update_key_limit(config.openrouter_key_id, new_limit)
    await db.flush()


async def sync_tenant_budget_to_plan(db: AsyncSession, tenant: Tenant) -> None:
    """Resolve the tenant's current plan and call `update_tenant_plan_limit`.

    Convenience helper for places that already have a Tenant ORM object
    (admin subscription toggle, offline-payment approval). Does nothing if
    the tenant has no plan assigned yet.
    """
    if tenant.plan_id is None:
        return
    plan_row = await db.execute(select(Plan).where(Plan.id == tenant.plan_id))
    plan = plan_row.scalar_one_or_none()
    if plan is None:
        return
    await update_tenant_plan_limit(db, tenant.id, plan.slug)


async def delete_tenant_ai_key(db: AsyncSession, tenant_id: uuid.UUID) -> None:
    """Called on account deletion — removes sub-key from OpenRouter."""
    result = await db.execute(select(TenantOpenRouterConfig).where(TenantOpenRouterConfig.tenant_id == tenant_id))
    config = result.scalar_one_or_none()
    if config and config.openrouter_key_id:
        await delete_key(config.openrouter_key_id)


async def get_admin_ai_usage(db: AsyncSession) -> AdminAIUsageResponse:
    """Return AI usage for all active tenants (admin-only)."""
    from sqlalchemy.orm import selectinload

    tenants_result = await db.execute(
        select(Tenant, Plan, TenantOpenRouterConfig)
        .outerjoin(Plan, Tenant.plan_id == Plan.id)
        .outerjoin(TenantOpenRouterConfig, TenantOpenRouterConfig.tenant_id == Tenant.id)
        .where(Tenant.is_active == True)
        .order_by(TenantOpenRouterConfig.usage_usd.desc().nullsfirst())
    )

    rows = []
    total_usage = 0.0
    total_limit = 0.0

    for tenant, plan, config in tenants_result.all():
        limit = float(config.monthly_limit_usd) if config else 2.50
        usage = float(config.usage_usd) if config else 0.0
        remaining = max(0.0, limit - usage)
        pct = round((usage / limit) * 100, 1) if limit > 0 else 0.0
        total_usage += usage
        total_limit += limit

        rows.append(AdminTenantAIUsageRow(
            tenant_id=tenant.id,
            tenant_name=tenant.name,
            plan_slug=plan.slug if plan else None,
            monthly_limit_usd=limit,
            usage_usd=usage,
            remaining_usd=remaining,
            usage_pct=pct,
            usage_synced_at=config.usage_synced_at if config else None,
            has_key=bool(config and config.openrouter_key_encrypted),
        ))

    return AdminAIUsageResponse(
        tenants=rows,
        total_tenants=len(rows),
        total_usage_usd=round(total_usage, 4),
        total_limit_usd=round(total_limit, 4),
    )


def _next_reset() -> datetime:
    now = datetime.now(timezone.utc)
    # First day of next month
    if now.month == 12:
        return now.replace(year=now.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    return now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0)
