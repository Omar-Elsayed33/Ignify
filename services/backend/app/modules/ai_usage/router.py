"""AI usage endpoints — tenant self-service + admin analytics."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_permission
from app.db.database import get_db
from app.dependencies import get_current_user
from app.modules.ai_usage.schemas import AIUsageResponse, AdminAIUsageResponse
from app.modules.ai_usage.service import get_admin_ai_usage, get_tenant_usage

router = APIRouter(prefix="/ai-usage", tags=["ai-usage"])


@router.get("/me", response_model=AIUsageResponse)
async def my_ai_usage(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return AI credit balance for the current tenant."""
    return await get_tenant_usage(db, current_user.tenant_id)


@router.get("/admin", response_model=AdminAIUsageResponse)
async def admin_ai_usage(
    current_user=Depends(require_permission("*")),
    db: AsyncSession = Depends(get_db),
):
    """Superadmin-only: return AI usage across all tenants."""
    return await get_admin_ai_usage(db)
