"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { hasPermission, isOwner } from "@/lib/rbac";
import {
  UserPlus,
  Send,
  RefreshCw,
  XCircle,
  Crown,
  Shield,
  MoreVertical,
  UserMinus,
  UserCog,
  Loader2,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { clsx } from "clsx";

type Role = "owner" | "admin" | "editor" | "viewer";

interface Member {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  email_verified: boolean;
  last_login?: string | null;
  created_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: "pending" | "accepted" | "expired" | "cancelled";
  invited_by_name?: string | null;
  expires_at: string;
  accept_url?: string | null;
}

const ROLE_ORDER: Role[] = ["owner", "admin", "editor", "viewer"];

const ROLE_BADGE_STYLES: Record<string, string> = {
  owner: "bg-warning/10 text-warning border-warning/30",
  admin: "bg-primary/10 text-primary border-primary/30",
  editor: "bg-success/10 text-success border-success/30",
  viewer: "bg-surface-hover text-text-secondary border-border",
};

export default function TeamPage() {
  const t = useTranslations("team");
  const locale = useLocale();
  const { user } = useAuthStore();
  const myRole = (user?.role as Role | undefined) ?? "viewer";

  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const canInvite = hasPermission(myRole, "team.invite");
  const canChangeRole = hasPermission(myRole, "team.change_role");
  const canRemove = hasPermission(myRole, "team.remove");
  const canTransfer = hasPermission(myRole, "team.transfer");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [m, i] = await Promise.all([
        api.get<Member[]>("/api/v1/team/members"),
        canInvite
          ? api.get<Invitation[]>(`/api/v1/team/invitations?lang=${locale}`)
          : Promise.resolve<Invitation[]>([]),
      ]);
      setMembers(m);
      setInvitations(i);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.failed"));
    } finally {
      setLoading(false);
    }
  }, [canInvite, locale, t]);

  useEffect(() => {
    load();
  }, [load]);

  const showFlash = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(""), 3000);
  };

  // ── Member actions ───────────────────────────────────────────────────────
  const handleChangeRole = async (m: Member, newRole: Role) => {
    try {
      await api.patch(`/api/v1/team/members/${m.id}`, { role: newRole });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("errors.failed"));
    }
  };

  const handleDeactivate = async (m: Member) => {
    try {
      await api.patch(`/api/v1/team/members/${m.id}`, { is_active: !m.is_active });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("errors.failed"));
    }
  };

  const handleRemove = async (m: Member) => {
    if (!confirm(t("actions.remove") + ": " + m.email + "?")) return;
    try {
      await api.delete(`/api/v1/team/members/${m.id}`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("errors.failed"));
    }
  };

  // ── Invitation actions ───────────────────────────────────────────────────
  const handleResend = async (inv: Invitation) => {
    try {
      await api.post(`/api/v1/team/invitations/${inv.id}/resend?lang=${locale}`);
      showFlash(t("invitations.resent"));
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("errors.failed"));
    }
  };

  const handleCancelInvite = async (inv: Invitation) => {
    try {
      await api.delete(`/api/v1/team/invitations/${inv.id}`);
      showFlash(t("invitations.cancelled"));
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("errors.failed"));
    }
  };

  // ── Role change menu: which roles can I assign to target? ────────────────
  const assignableRoles = (target: Member): Role[] => {
    if (!canChangeRole) return [];
    if (target.role === "owner") return [];
    if (target.role === "admin" && !isOwner(myRole)) return [];
    return ["admin", "editor", "viewer"];
  };

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <main className="mx-auto max-w-6xl p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{t("title")}</h1>
            <p className="mt-1 text-sm text-text-secondary">{t("subtitle")}</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm">
              <span className="text-text-muted">{t("currentRole")}:</span>
              <RoleBadge role={myRole} t={t} />
            </div>
          </div>
          {canInvite && (
            <button
              onClick={() => setInviteOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
            >
              <UserPlus className="h-4 w-4" />
              {t("members.invite")}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}
        {flash && (
          <div className="mb-4 rounded-lg bg-success/10 px-4 py-3 text-sm text-success">
            {flash}
          </div>
        )}

        {/* ── Members ──────────────────────────────────────────────── */}
        <section className="mb-8 rounded-xl border border-border bg-surface">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-text-primary">
              {t("members.title")}
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
            </div>
          ) : members.length === 0 ? (
            <div className="p-6">
              <EmptyState title={t("members.empty")} description="" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-hover text-left text-xs uppercase tracking-wide text-text-muted">
                  <tr>
                    <th className="px-6 py-3">{t("members.columns.name")}</th>
                    <th className="px-6 py-3">{t("members.columns.email")}</th>
                    <th className="px-6 py-3">{t("members.columns.role")}</th>
                    <th className="px-6 py-3">{t("members.columns.status")}</th>
                    <th className="px-6 py-3">{t("members.columns.lastLogin")}</th>
                    <th className="px-6 py-3 text-end">{t("members.columns.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td className="px-6 py-3 font-medium text-text-primary">
                        {m.full_name}
                      </td>
                      <td className="px-6 py-3 text-text-secondary">{m.email}</td>
                      <td className="px-6 py-3">
                        <RoleBadge role={m.role} t={t} />
                      </td>
                      <td className="px-6 py-3">
                        <StatusBadge m={m} t={t} />
                      </td>
                      <td className="px-6 py-3 text-text-muted">
                        {m.last_login
                          ? new Date(m.last_login).toLocaleString(locale)
                          : "—"}
                      </td>
                      <td className="px-6 py-3 text-end">
                        <MemberRowMenu
                          member={m}
                          myUserId={user?.id}
                          assignable={assignableRoles(m)}
                          canRemove={
                            canRemove && m.role !== "owner" && m.id !== user?.id
                          }
                          canTransfer={canTransfer && m.role !== "owner"}
                          onChangeRole={handleChangeRole}
                          onDeactivate={handleDeactivate}
                          onRemove={handleRemove}
                          onTransfer={() => setTransferOpen(true)}
                          t={t}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Invitations ──────────────────────────────────────────── */}
        {canInvite && (
          <section className="rounded-xl border border-border bg-surface">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-text-primary">
                {t("invitations.title")}
              </h2>
            </div>
            {invitations.length === 0 ? (
              <div className="p-6">
                <EmptyState title={t("invitations.empty")} description="" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-hover text-left text-xs uppercase tracking-wide text-text-muted">
                    <tr>
                      <th className="px-6 py-3">{t("invitations.columns.email")}</th>
                      <th className="px-6 py-3">{t("invitations.columns.role")}</th>
                      <th className="px-6 py-3">
                        {t("invitations.columns.invitedBy")}
                      </th>
                      <th className="px-6 py-3">{t("invitations.columns.expires")}</th>
                      <th className="px-6 py-3">{t("invitations.columns.status")}</th>
                      <th className="px-6 py-3 text-end">
                        {t("invitations.columns.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invitations.map((inv) => (
                      <tr key={inv.id}>
                        <td className="px-6 py-3 text-text-primary">{inv.email}</td>
                        <td className="px-6 py-3">
                          <RoleBadge role={inv.role} t={t} />
                        </td>
                        <td className="px-6 py-3 text-text-secondary">
                          {inv.invited_by_name ?? "—"}
                        </td>
                        <td className="px-6 py-3 text-text-muted">
                          {new Date(inv.expires_at).toLocaleDateString(locale)}
                        </td>
                        <td className="px-6 py-3">
                          <span
                            className={clsx(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                              inv.status === "pending" &&
                                "border-primary/30 bg-primary/10 text-primary",
                              inv.status === "expired" &&
                                "border-warning/30 bg-warning/10 text-warning",
                              inv.status === "accepted" &&
                                "border-success/30 bg-success/10 text-success",
                              inv.status === "cancelled" &&
                                "border-border bg-surface-hover text-text-muted"
                            )}
                          >
                            {t(`invitations.status.${inv.status}`)}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-end">
                          <div className="inline-flex gap-2">
                            <button
                              onClick={() => handleResend(inv)}
                              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-hover"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              {t("invitations.resend")}
                            </button>
                            <button
                              onClick={() => handleCancelInvite(inv)}
                              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-error hover:bg-error/10"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              {t("invitations.cancel")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>

      {/* ── Invite modal ─────────────────────────────────────────────── */}
      {inviteOpen && (
        <InviteModal
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          locale={locale}
          onSent={async () => {
            setInviteOpen(false);
            showFlash(t("invite.success"));
            await load();
          }}
        />
      )}

      {/* ── Transfer ownership modal ─────────────────────────────────── */}
      {transferOpen && canTransfer && (
        <TransferModal
          open={transferOpen}
          onOpenChange={setTransferOpen}
          currentOwnerEmail={user?.email ?? ""}
          members={members.filter(
            (m) => m.role !== "owner" && m.is_active && m.id !== user?.id
          )}
          onDone={async () => {
            setTransferOpen(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────

function RoleBadge({
  role,
  t,
}: {
  role: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const style = ROLE_BADGE_STYLES[role] ?? ROLE_BADGE_STYLES.viewer;
  const Icon = role === "owner" ? Crown : role === "admin" ? Shield : null;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        style
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {t(`roles.${role}`)}
    </span>
  );
}

function StatusBadge({
  m,
  t,
}: {
  m: Member;
  t: ReturnType<typeof useTranslations>;
}) {
  const key = !m.is_active
    ? "inactive"
    : !m.email_verified
    ? "unverified"
    : "active";
  const style =
    key === "active"
      ? "border-success/30 bg-success/10 text-success"
      : key === "unverified"
      ? "border-warning/30 bg-warning/10 text-warning"
      : "border-border bg-surface-hover text-text-muted";
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        style
      )}
    >
      {t(`members.status.${key}`)}
    </span>
  );
}

function MemberRowMenu({
  member,
  myUserId,
  assignable,
  canRemove,
  canTransfer,
  onChangeRole,
  onDeactivate,
  onRemove,
  onTransfer,
  t,
}: {
  member: Member;
  myUserId?: string;
  assignable: Role[];
  canRemove: boolean;
  canTransfer: boolean;
  onChangeRole: (m: Member, r: Role) => void;
  onDeactivate: (m: Member) => void;
  onRemove: (m: Member) => void;
  onTransfer: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  if (
    assignable.length === 0 &&
    !canRemove &&
    !canTransfer &&
    member.id !== myUserId
  ) {
    return <span className="text-text-muted">—</span>;
  }
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="rounded-md p-1.5 text-text-muted hover:bg-surface-hover">
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-50 min-w-[180px] rounded-lg border border-border bg-surface p-1 shadow-lg"
        >
          {assignable.length > 0 && (
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-text-primary hover:bg-surface-hover">
                <UserCog className="h-4 w-4" />
                {t("actions.changeRole")}
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.SubContent className="z-50 min-w-[140px] rounded-lg border border-border bg-surface p-1 shadow-lg">
                  {assignable.map((r) => (
                    <DropdownMenu.Item
                      key={r}
                      onSelect={() => onChangeRole(member, r)}
                      disabled={r === member.role}
                      className={clsx(
                        "cursor-pointer rounded px-2 py-1.5 text-sm",
                        r === member.role
                          ? "text-text-muted"
                          : "text-text-primary hover:bg-surface-hover"
                      )}
                    >
                      {t(`roles.${r}`)}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>
          )}
          {canRemove && member.id !== myUserId && (
            <>
              <DropdownMenu.Item
                onSelect={() => onDeactivate(member)}
                className="cursor-pointer rounded px-2 py-1.5 text-sm text-text-primary hover:bg-surface-hover"
              >
                {t("actions.deactivate")}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => onRemove(member)}
                className="cursor-pointer rounded px-2 py-1.5 text-sm text-error hover:bg-error/10"
              >
                <div className="flex items-center gap-2">
                  <UserMinus className="h-4 w-4" />
                  {t("actions.remove")}
                </div>
              </DropdownMenu.Item>
            </>
          )}
          {canTransfer && member.role !== "owner" && (
            <DropdownMenu.Item
              onSelect={onTransfer}
              className="cursor-pointer rounded px-2 py-1.5 text-sm text-text-primary hover:bg-surface-hover"
            >
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4" />
                {t("actions.transferOwnership")}
              </div>
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function InviteModal({
  open,
  onOpenChange,
  locale,
  onSent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  locale: string;
  onSent: () => Promise<void>;
}) {
  const t = useTranslations("team");
  const tCommon = useTranslations("common");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "viewer">("viewer");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.post(`/api/v1/team/members/invite?lang=${locale}`, {
        email,
        role,
        message: message || null,
      });
      await onSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("errors.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t("invite.title")}>
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
            {error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">
            {t("invite.email")}
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">
            {t("invite.role")}
          </label>
          <select
            value={role}
            onChange={(e) =>
              setRole(e.target.value as "admin" | "editor" | "viewer")
            }
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="admin">{t("roles.admin")}</option>
            <option value="editor">{t("roles.editor")}</option>
            <option value="viewer">{t("roles.viewer")}</option>
          </select>
          <p className="mt-1 text-xs text-text-muted">
            {t(`roleDescriptions.${role}`)}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">
            {t("invite.message")}
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder={t("invite.messagePlaceholder")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-hover"
          >
            {tCommon("cancel")}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {submitting ? t("invite.sending") : t("invite.submit")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TransferModal({
  open,
  onOpenChange,
  members,
  currentOwnerEmail,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  members: Member[];
  currentOwnerEmail: string;
  onDone: () => Promise<void>;
}) {
  const t = useTranslations("team");
  const tCommon = useTranslations("common");
  const [targetId, setTargetId] = useState<string>(members[0]?.id ?? "");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const emailMatches =
    currentOwnerEmail.length > 0 &&
    confirmEmail.trim().toLowerCase() === currentOwnerEmail.trim().toLowerCase();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId || !emailMatches) return;
    setSubmitting(true);
    setError("");
    try {
      await api.post("/api/v1/team/transfer-ownership", {
        new_owner_id: targetId,
      });
      // Force logout since role changed, then redirect to login with success flag.
      try {
        useAuthStore.getState().logout();
      } catch {
        /* ignore */
      }
      if (typeof window !== "undefined") {
        window.location.href = `/login?msg=${encodeURIComponent(
          "team.transfer.success"
        )}`;
      }
      await onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("errors.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t("transfer.title")}>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          <div className="font-medium">{t("transfer.warning2")}</div>
          <div>{t("transfer.warningDemotion")}</div>
        </div>
        {error && (
          <div className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
            {error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">
            {t("transfer.selectMember")}
          </label>
          <select
            required
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name} ({m.email})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">
            {t("transfer.typeToConfirm", { email: currentOwnerEmail })}
          </label>
          <input
            type="email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder={currentOwnerEmail}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            autoComplete="off"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-hover"
          >
            {tCommon("cancel")}
          </button>
          <button
            type="submit"
            disabled={submitting || !targetId || !emailMatches}
            className="inline-flex items-center gap-2 rounded-lg bg-warning px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("transfer.confirm")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
