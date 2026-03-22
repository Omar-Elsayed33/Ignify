"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import Modal from "@/components/Modal";
import { Plus, Mail, Share2, Megaphone, Layers } from "lucide-react";
import { clsx } from "clsx";

const typeIcons: Record<string, React.ElementType> = {
  email: Mail,
  social: Share2,
  ads: Megaphone,
  multi: Layers,
};

const mockCampaigns = [
  { id: "1", name: "Summer Sale 2026", type: "email", status: "active", startDate: "2026-03-01", endDate: "2026-03-31", progress: 65 },
  { id: "2", name: "Brand Awareness Q1", type: "social", status: "active", startDate: "2026-01-15", endDate: "2026-03-30", progress: 88 },
  { id: "3", name: "Product Launch Wave", type: "multi", status: "draft", startDate: "2026-04-01", endDate: "2026-04-30", progress: 0 },
  { id: "4", name: "Retargeting Campaign", type: "ads", status: "active", startDate: "2026-02-15", endDate: "2026-04-15", progress: 42 },
  { id: "5", name: "Holiday Promo 2025", type: "email", status: "completed", startDate: "2025-12-01", endDate: "2025-12-31", progress: 100 },
  { id: "6", name: "New Year Push", type: "social", status: "completed", startDate: "2025-12-28", endDate: "2026-01-15", progress: 100 },
  { id: "7", name: "Webinar Invite", type: "email", status: "paused", startDate: "2026-03-10", endDate: "2026-03-25", progress: 30 },
  { id: "8", name: "Influencer Collab", type: "social", status: "draft", startDate: "2026-04-05", endDate: "2026-05-05", progress: 0 },
];

const statusColors: Record<string, string> = {
  active: "bg-success/10 text-success",
  draft: "bg-text-muted/10 text-text-muted",
  completed: "bg-info/10 text-info",
  paused: "bg-warning/10 text-warning",
};

export default function CampaignsPage() {
  const t = useTranslations("campaignsPage");
  const [createOpen, setCreateOpen] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const filtered = mockCampaigns.filter((c) => {
    if (filterType !== "all" && c.type !== filterType) return false;
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    return true;
  });

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-primary focus:border-primary focus:outline-none"
            >
              <option value="all">{t("campaignType")}</option>
              <option value="email">{t("email")}</option>
              <option value="social">{t("social")}</option>
              <option value="ads">{t("ads")}</option>
              <option value="multi">{t("multi")}</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-primary focus:border-primary focus:outline-none"
            >
              <option value="all">{t("status")}</option>
              <option value="active">{t("active")}</option>
              <option value="draft">{t("draft")}</option>
              <option value="completed">{t("completed")}</option>
              <option value="paused">{t("paused")}</option>
            </select>
          </div>

          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" />
            {t("createCampaign")}
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((campaign) => {
            const TypeIcon = typeIcons[campaign.type] || Layers;
            return (
              <div
                key={campaign.id}
                className="rounded-xl border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <TypeIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{campaign.name}</p>
                      <p className="text-xs capitalize text-text-muted">{t(campaign.type as "email" | "social" | "ads" | "multi")}</p>
                    </div>
                  </div>
                  <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", statusColors[campaign.status])}>
                    {t(campaign.status as "active" | "draft" | "completed" | "paused")}
                  </span>
                </div>

                <div className="mt-4 flex justify-between text-xs text-text-muted">
                  <span>{t("startDate")}: {campaign.startDate}</span>
                  <span>{t("endDate")}: {campaign.endDate}</span>
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">{t("progress")}</span>
                    <span className="font-medium text-text-primary">{campaign.progress}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-background">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${campaign.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal open={createOpen} onOpenChange={setCreateOpen} title={t("createCampaign")}>
        <form className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("campaignName")}</label>
            <input type="text" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("campaignType")}</label>
            <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="email">{t("email")}</option>
              <option value="social">{t("social")}</option>
              <option value="ads">{t("ads")}</option>
              <option value="multi">{t("multi")}</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("startDate")}</label>
              <input type="date" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("endDate")}</label>
              <input type="date" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setCreateOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover">Cancel</button>
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">{t("createCampaign")}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
