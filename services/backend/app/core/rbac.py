"""Role-Based Access Control: permission matrix + FastAPI dependencies."""
from __future__ import annotations

from typing import Annotated, Callable

from fastapi import Depends, HTTPException, status

from app.db.models import User, UserRole
from app.dependencies import get_current_user

PERMISSIONS: dict[str, set[str]] = {
    "owner": {
        "billing",
        "team.invite",
        "team.remove",
        "team.change_role",
        "team.transfer",
        "agents.configure",
        "plans.approve",
        "content.all",
        "ads.all",
        "settings.all",
    },
    "admin": {
        "team.invite",
        "team.remove",
        "team.change_role",
        "agents.configure",
        "plans.approve",
        "content.all",
        "ads.all",
        "settings.view",
    },
    "editor": {
        "content.create",
        "content.edit",
        "plans.view",
        "inbox.respond",
    },
    "viewer": {
        "content.view",
        "plans.view",
        "inbox.view",
        "analytics.view",
    },
    "superadmin": {"*"},
}


def _role_value(role) -> str:
    if isinstance(role, UserRole):
        return role.value
    return str(role)


def has_permission(role, perm: str) -> bool:
    """Return True if the given role has the given permission."""
    role_key = _role_value(role)
    granted = PERMISSIONS.get(role_key, set())
    if "*" in granted:
        return True
    if perm in granted:
        return True
    # Support wildcard families, e.g. "content.all" implies "content.*"
    for p in granted:
        if p.endswith(".all"):
            prefix = p[: -len(".all")] + "."
            if perm.startswith(prefix):
                return True
    return False


def require_permission(perm: str) -> Callable:
    """FastAPI dependency that enforces a permission string on current user."""

    async def checker(user: Annotated[User, Depends(get_current_user)]) -> User:
        if not has_permission(user.role, perm):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{perm}' required",
            )
        return user

    return checker
