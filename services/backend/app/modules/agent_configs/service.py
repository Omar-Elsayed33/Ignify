"""Tenant-scoped agent config service.

Returns the effective configuration per agent (tenant override if present,
else defaults from AGENT_MODELS).
"""
from __future__ import annotations

import uuid
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.models import AGENT_MODELS
from app.agents.registry import AGENT_REGISTRY
from app.db.models import TenantAgentConfig
from app.modules.agent_configs.schemas import AgentConfigItem, AgentConfigUpdate


def _agent_names() -> List[str]:
    names = set(AGENT_MODELS.keys())
    names.update(AGENT_REGISTRY.keys())
    return sorted(names)


async def list_configs(db: AsyncSession, tenant_id: uuid.UUID) -> list[AgentConfigItem]:
    result = await db.execute(
        select(TenantAgentConfig).where(TenantAgentConfig.tenant_id == tenant_id)
    )
    overrides = {c.agent_name: c for c in result.scalars().all()}

    items: list[AgentConfigItem] = []
    for name in _agent_names():
        default_model = AGENT_MODELS.get(name, "anthropic/claude-sonnet-4-5")
        cfg = overrides.get(name)
        if cfg:
            items.append(
                AgentConfigItem(
                    agent_name=name,
                    model=cfg.model or default_model,
                    system_prompt=cfg.system_prompt,
                    temperature=cfg.temperature,
                    max_tokens=cfg.max_tokens,
                    is_enabled=cfg.is_enabled,
                    is_overridden=True,
                )
            )
        else:
            items.append(
                AgentConfigItem(
                    agent_name=name,
                    model=default_model,
                    system_prompt=None,
                    temperature=None,
                    max_tokens=None,
                    is_enabled=True,
                    is_overridden=False,
                )
            )
    return items


async def upsert_config(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    agent_name: str,
    data: AgentConfigUpdate,
) -> AgentConfigItem:
    result = await db.execute(
        select(TenantAgentConfig).where(
            TenantAgentConfig.tenant_id == tenant_id,
            TenantAgentConfig.agent_name == agent_name,
        )
    )
    cfg = result.scalar_one_or_none()
    if cfg is None:
        cfg = TenantAgentConfig(tenant_id=tenant_id, agent_name=agent_name)
        db.add(cfg)

    payload = data.model_dump(exclude_unset=True)
    for field, value in payload.items():
        setattr(cfg, field, value)
    await db.flush()

    default_model = AGENT_MODELS.get(agent_name, "anthropic/claude-sonnet-4-5")
    return AgentConfigItem(
        agent_name=agent_name,
        model=cfg.model or default_model,
        system_prompt=cfg.system_prompt,
        temperature=cfg.temperature,
        max_tokens=cfg.max_tokens,
        is_enabled=cfg.is_enabled,
        is_overridden=True,
    )
