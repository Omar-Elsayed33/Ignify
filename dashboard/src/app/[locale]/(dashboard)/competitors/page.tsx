"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import EmptyState from "@/components/EmptyState";
import Modal from "@/components/Modal";
import { Plus, Eye, Globe, Clock, ExternalLink } from "lucide-react";

const mockCompetitors = [
  { id: "1", name: "MarketAI Pro", website: "marketai.pro", lastUpdated: "2026-03-20", seoScore: 78, socialFollowers: "45K", adSpend: "$15K/mo" },
  { id: "2", name: "ContentBot", website: "contentbot.io", lastUpdated: "2026-03-19", seoScore: 82, socialFollowers: "32K", adSpend: "$8K/mo" },
  { id: "3", name: "AdGenius", website: "adgenius.com", lastUpdated: "2026-03-18", seoScore: 71, socialFollowers: "28K", adSpend: "$22K/mo" },
  { id: "4", name: "GrowthEngine", website: "growthengine.ai", lastUpdated: "2026-03-17", seoScore: 85, socialFollowers: "56K", adSpend: "$12K/mo" },
];

export default function CompetitorsPage() {
  const t = useTranslations("competitorsPage");
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        <div className="mb-6 flex items-center justify-end">
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" />
            {t("addCompetitor")}
          </button>
        </div>

        {mockCompetitors.length === 0 ? (
          <EmptyState
            icon={Eye}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            actionLabel={t("addCompetitor")}
            onAction={() => setAddOpen(true)}
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {mockCompetitors.map((competitor) => (
                <div
                  key={competitor.id}
                  className="rounded-xl border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-text-primary">{competitor.name}</h4>
                      <div className="mt-1 flex items-center gap-1 text-xs text-text-muted">
                        <Globe className="h-3 w-3" />
                        {competitor.website}
                        <ExternalLink className="h-3 w-3" />
                      </div>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {competitor.seoScore}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-text-muted">Social Followers</p>
                      <p className="text-sm font-medium text-text-primary">{competitor.socialFollowers}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">Est. Ad Spend</p>
                      <p className="text-sm font-medium text-text-primary">{competitor.adSpend}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-1 text-xs text-text-muted">
                    <Clock className="h-3 w-3" />
                    {t("lastUpdated")}: {competitor.lastUpdated}
                  </div>
                </div>
              ))}
            </div>

            {/* Comparison placeholder */}
            <div className="mt-6 rounded-xl border border-dashed border-border bg-surface p-12 text-center">
              <Eye className="mx-auto h-10 w-10 text-text-muted/40" />
              <p className="mt-3 text-sm font-medium text-text-secondary">{t("comparison")}</p>
              <p className="mt-1 text-xs text-text-muted">Detailed comparison analysis coming soon</p>
            </div>
          </>
        )}
      </div>

      <Modal open={addOpen} onOpenChange={setAddOpen} title={t("addCompetitor")}>
        <form className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("competitorName")}</label>
            <input type="text" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("website")}</label>
            <input type="url" placeholder="https://" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setAddOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover">Cancel</button>
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">{t("addCompetitor")}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
