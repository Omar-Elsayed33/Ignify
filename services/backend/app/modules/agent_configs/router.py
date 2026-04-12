from fastapi import APIRouter

from app.dependencies import CurrentTenant, DbSession
from app.modules.agent_configs.schemas import AgentConfigItem, AgentConfigUpdate
from app.modules.agent_configs.service import list_configs, upsert_config

router = APIRouter(prefix="/agent-configs", tags=["agent-configs"])


@router.get("", response_model=list[AgentConfigItem])
async def list_agent_configs(tenant: CurrentTenant, db: DbSession):
    return await list_configs(db, tenant.id)


@router.put("/{agent_name}", response_model=AgentConfigItem)
async def update_agent_config(
    agent_name: str,
    data: AgentConfigUpdate,
    tenant: CurrentTenant,
    db: DbSession,
):
    return await upsert_config(db, tenant.id, agent_name, data)
