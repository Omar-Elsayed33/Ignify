"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import DataTable, { Column } from "@/components/DataTable";
import Modal from "@/components/Modal";
import { Loader2, UserPlus } from "lucide-react";
import { clsx } from "clsx";
import * as Avatar from "@radix-ui/react-avatar";
import { api } from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────

type UserRole = "owner" | "admin" | "editor" | "viewer" | "superadmin";

interface TeamMember {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  [key: string]: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const roleColors: Record<string, string> = {
  owner: "bg-primary/10 text-primary",
  superadmin: "bg-primary/10 text-primary",
  admin: "bg-accent/10 text-accent",
  editor: "bg-info/10 text-info",
  viewer: "bg-text-muted/10 text-text-muted",
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const t = useTranslations("teamPage");

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite modal state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("viewer");
  const [inviting, setInviting] = useState(false);

  // Role update state — tracks which member is being saved
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  async function fetchMembers() {
    const data = await api.get<TeamMember[]>("/api/v1/users/");
    setMembers(data);
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        await fetchMembers();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load team");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Invite ────────────────────────────────────────────────────────────────

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    try {
      setInviting(true);
      await api.post("/api/v1/users/invite", {
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("viewer");
      // Refresh list
      await fetchMembers();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setInviting(false);
    }
  }

  // ── Role update ───────────────────────────────────────────────────────────

  async function handleRoleChange(memberId: string, newRole: UserRole) {
    try {
      setUpdatingId(memberId);
      const updated = await api.put<TeamMember>(`/api/v1/users/${memberId}`, {
        role: newRole,
      });
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: updated.role } : m))
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Role update failed");
    } finally {
      setUpdatingId(null);
    }
  }

  // ── Columns ───────────────────────────────────────────────────────────────

  const columns: Column<TeamMember>[] = [
    {
      key: "full_name",
      label: t("memberName"),
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-3">
          <Avatar.Root className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
            <Avatar.Fallback className="text-xs font-semibold text-white">
              {initials(item.full_name)}
            </Avatar.Fallback>
          </Avatar.Root>
          <span className="font-medium">{item.full_name}</span>
        </div>
      ),
    },
    { key: "email", label: t("memberEmail") },
    {
      key: "role",
      label: t("role"),
      render: (item) => (
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
              roleColors[item.role] ?? roleColors.viewer
            )}
          >
            {t(item.role as "owner" | "admin" | "editor" | "viewer")}
          </span>
          {item.role !== "owner" && item.role !== "superadmin" && (
            <select
              value={item.role}
              disabled={updatingId === item.id}
              onChange={(e) =>
                handleRoleChange(item.id, e.target.value as UserRole)
              }
              className="rounded border border-border bg-background px-1.5 py-0.5 text-xs text-text-secondary focus:outline-none disabled:opacity-50"
            >
              <option value="admin">{t("admin")}</option>
              <option value="editor">{t("editor")}</option>
              <option value="viewer">{t("viewer")}</option>
            </select>
          )}
          {updatingId === item.id && (
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
          )}
        </div>
      ),
    },
    {
      key: "is_active",
      label: t("memberStatus"),
      render: (item) => (
        <span
          className={clsx(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            item.is_active
              ? "bg-success/10 text-success"
              : "bg-warning/10 text-warning"
          )}
        >
          {item.is_active ? t("activeStatus") : t("pending")}
        </span>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div>
        <DashboardHeader title={t("title")} />
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <DashboardHeader title={t("title")} />
        <div className="p-6">
          <p className="text-sm text-error">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        <div className="mb-6 flex items-center justify-end">
          <button
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <UserPlus className="h-4 w-4" />
            {t("inviteMember")}
          </button>
        </div>

        {members.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-10 text-center text-sm text-text-muted">
            {t("noMembers")}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={members as unknown as Record<string, unknown>[]}
          />
        )}
      </div>

      <Modal open={inviteOpen} onOpenChange={setInviteOpen} title={t("inviteMember")}>
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("memberEmail")}
            </label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("role")}
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="admin">{t("admin")}</option>
              <option value="editor">{t("editor")}</option>
              <option value="viewer">{t("viewer")}</option>
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setInviteOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={inviting}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {inviting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("inviteMember")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
