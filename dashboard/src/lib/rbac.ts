// Role-based permissions mirror of services/backend/app/core/rbac.py
export const PERMISSIONS: Record<string, string[]> = {
  owner: [
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
  ],
  admin: [
    "team.invite",
    "team.remove",
    "team.change_role",
    "agents.configure",
    "plans.approve",
    "content.all",
    "ads.all",
    "settings.view",
  ],
  editor: [
    "content.create",
    "content.edit",
    "plans.view",
    "inbox.respond",
  ],
  viewer: [
    "content.view",
    "plans.view",
    "inbox.view",
    "analytics.view",
  ],
  superadmin: ["*"],
};

export function hasPermission(role: string | undefined | null, perm: string): boolean {
  if (!role) return false;
  const granted = PERMISSIONS[role] ?? [];
  if (granted.includes("*")) return true;
  if (granted.includes(perm)) return true;
  for (const p of granted) {
    if (p.endsWith(".all")) {
      const prefix = p.slice(0, -".all".length) + ".";
      if (perm.startsWith(prefix)) return true;
    }
  }
  return false;
}

// Roles considered "manager-level" (shown owner UI etc.)
export function isOwner(role: string | undefined | null): boolean {
  return role === "owner";
}

export function canManageTeam(role: string | undefined | null): boolean {
  return hasPermission(role, "team.invite");
}
