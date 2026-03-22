"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import DataTable, { Column } from "@/components/DataTable";
import Modal from "@/components/Modal";
import { UserPlus } from "lucide-react";
import { clsx } from "clsx";
import * as Avatar from "@radix-ui/react-avatar";

interface TeamMember {
  name: string;
  email: string;
  role: string;
  status: string;
  avatar: string;
  [key: string]: unknown;
}

const mockMembers: TeamMember[] = [
  { name: "John Smith", email: "john@ignify.ai", role: "owner", status: "active", avatar: "J" },
  { name: "Sarah Johnson", email: "sarah@ignify.ai", role: "admin", status: "active", avatar: "S" },
  { name: "Ahmed Hassan", email: "ahmed@ignify.ai", role: "editor", status: "active", avatar: "A" },
  { name: "Maria Garcia", email: "maria@ignify.ai", role: "editor", status: "active", avatar: "M" },
  { name: "James Chen", email: "james@ignify.ai", role: "viewer", status: "pending", avatar: "J" },
  { name: "Fatima Al-Rashid", email: "fatima@ignify.ai", role: "viewer", status: "active", avatar: "F" },
];

const roleColors: Record<string, string> = {
  owner: "bg-primary/10 text-primary",
  admin: "bg-accent/10 text-accent",
  editor: "bg-info/10 text-info",
  viewer: "bg-text-muted/10 text-text-muted",
};

export default function TeamPage() {
  const t = useTranslations("teamPage");
  const [inviteOpen, setInviteOpen] = useState(false);

  const columns: Column<TeamMember>[] = [
    {
      key: "name",
      label: t("memberName"),
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-3">
          <Avatar.Root className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
            <Avatar.Fallback className="text-xs font-semibold text-white">
              {item.avatar}
            </Avatar.Fallback>
          </Avatar.Root>
          <span className="font-medium">{item.name}</span>
        </div>
      ),
    },
    { key: "email", label: t("memberEmail") },
    {
      key: "role",
      label: t("role"),
      render: (item) => (
        <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", roleColors[item.role])}>
          {t(item.role as "owner" | "admin" | "editor" | "viewer")}
        </span>
      ),
    },
    {
      key: "status",
      label: t("memberStatus"),
      render: (item) => (
        <span
          className={clsx(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            item.status === "active"
              ? "bg-success/10 text-success"
              : "bg-warning/10 text-warning"
          )}
        >
          {item.status === "active" ? t("activeStatus") : t("pending")}
        </span>
      ),
    },
  ];

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

        <DataTable
          columns={columns}
          data={mockMembers as unknown as Record<string, unknown>[]}
        />
      </div>

      <Modal open={inviteOpen} onOpenChange={setInviteOpen} title={t("inviteMember")}>
        <form className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("memberEmail")}
            </label>
            <input
              type="email"
              placeholder="colleague@company.com"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("role")}
            </label>
            <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="admin">{t("admin")}</option>
              <option value="editor">{t("editor")}</option>
              <option value="viewer">{t("viewer")}</option>
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setInviteOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
              {t("inviteMember")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
