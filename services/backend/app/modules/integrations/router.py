import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.db.models import Integration, IntegrationStatus, IntegrationToken
from app.dependencies import CurrentUser, DbSession
from app.modules.integrations.schemas import (
    IntegrationCreate,
    IntegrationResponse,
    OAuthCallbackRequest,
)

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get("/", response_model=list[IntegrationResponse])
async def list_integrations(user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Integration)
        .where(Integration.tenant_id == user.tenant_id)
        .order_by(Integration.created_at.desc())
    )
    return result.scalars().all()


@router.post("/connect", response_model=IntegrationResponse, status_code=status.HTTP_201_CREATED)
async def connect_integration(data: IntegrationCreate, user: CurrentUser, db: DbSession):
    # Check if integration already exists for this platform
    existing = await db.execute(
        select(Integration).where(
            Integration.tenant_id == user.tenant_id,
            Integration.platform == data.platform,
        )
    )
    integration = existing.scalar_one_or_none()
    if integration:
        integration.status = IntegrationStatus.connected
        integration.config = data.config or {}
    else:
        integration = Integration(
            tenant_id=user.tenant_id,
            platform=data.platform,
            status=IntegrationStatus.connected,
            config=data.config or {},
        )
        db.add(integration)
    await db.flush()
    return integration


@router.post("/{integration_id}/disconnect", response_model=IntegrationResponse)
async def disconnect_integration(integration_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Integration).where(Integration.id == integration_id, Integration.tenant_id == user.tenant_id)
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration not found")
    integration.status = IntegrationStatus.disconnected
    await db.flush()
    return integration


@router.get("/{integration_id}", response_model=IntegrationResponse)
async def get_integration(integration_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Integration).where(Integration.id == integration_id, Integration.tenant_id == user.tenant_id)
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration not found")
    return integration


@router.delete("/{integration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_integration(integration_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Integration).where(Integration.id == integration_id, Integration.tenant_id == user.tenant_id)
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration not found")
    await db.delete(integration)
    await db.flush()


@router.post("/oauth/callback")
async def oauth_callback(data: OAuthCallbackRequest, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Integration).where(Integration.id == data.integration_id, Integration.tenant_id == user.tenant_id)
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration not found")

    # In production, exchange code for tokens via OAuth provider
    token = IntegrationToken(
        integration_id=integration.id,
        access_token_encrypted=f"encrypted_{data.code}",
        refresh_token_encrypted=None,
    )
    db.add(token)
    integration.status = IntegrationStatus.connected
    await db.flush()
    return {"status": "connected", "integration_id": str(integration.id)}
