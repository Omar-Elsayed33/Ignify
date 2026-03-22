from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import Tenant, UserRole
from app.dependencies import CurrentTenant, CurrentUser, require_role
from app.modules.tenants.schemas import TenantResponse, TenantUpdate

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.get("/me", response_model=TenantResponse)
async def get_my_tenant(tenant: CurrentTenant):
    return tenant


@router.put("/me", response_model=TenantResponse)
async def update_my_tenant(
    data: TenantUpdate,
    tenant: CurrentTenant,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if user.role not in (UserRole.owner, UserRole.admin, UserRole.superadmin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners/admins can update tenant")
    if data.name is not None:
        tenant.name = data.name
    if data.config is not None:
        tenant.config = data.config
    await db.flush()
    return tenant
