"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import DataTable, { Column } from "@/components/DataTable";
import Modal from "@/components/Modal";
import { Plus, LayoutGrid, List } from "lucide-react";
import { clsx } from "clsx";

interface Lead {
  id: string;
  name: string;
  email: string;
  company: string;
  source: string;
  value: string;
  score: number;
  stage: string;
  [key: string]: unknown;
}

const mockLeads: Lead[] = [
  { id: "1", name: "Sarah Johnson", email: "sarah@techcorp.com", company: "TechCorp", source: "Website", value: "$12,000", score: 85, stage: "qualified" },
  { id: "2", name: "Ahmed Al-Rashid", email: "ahmed@innovate.sa", company: "Innovate SA", source: "LinkedIn", value: "$24,000", score: 92, stage: "proposal" },
  { id: "3", name: "Maria Garcia", email: "maria@global.co", company: "Global Co", source: "Referral", value: "$8,500", score: 68, stage: "contacted" },
  { id: "4", name: "James Chen", email: "james@startup.io", company: "Startup.io", source: "Google Ads", value: "$15,000", score: 74, stage: "new" },
  { id: "5", name: "Fatima Hassan", email: "fatima@enterprise.ae", company: "Enterprise AE", source: "Website", value: "$45,000", score: 95, stage: "won" },
  { id: "6", name: "Tom Wilson", email: "tom@smallbiz.com", company: "SmallBiz", source: "Cold Email", value: "$3,200", score: 42, stage: "lost" },
  { id: "7", name: "Lisa Park", email: "lisa@design.co", company: "Design Co", source: "Instagram", value: "$7,800", score: 61, stage: "new" },
  { id: "8", name: "Omar Khalid", email: "omar@media.sa", company: "Media SA", source: "Referral", value: "$18,000", score: 88, stage: "qualified" },
];

const stages = ["new", "contacted", "qualified", "proposal", "won", "lost"] as const;

const stageColors: Record<string, string> = {
  new: "border-info bg-info/5",
  contacted: "border-accent bg-accent/5",
  qualified: "border-primary bg-primary/5",
  proposal: "border-purple-500 bg-purple-500/5",
  won: "border-success bg-success/5",
  lost: "border-error bg-error/5",
};

export default function LeadsPage() {
  const t = useTranslations("leadsPage");
  const [view, setView] = useState<"pipeline" | "list">("pipeline");
  const [addOpen, setAddOpen] = useState(false);

  const scoreBadge = (score: number) => {
    const color = score >= 80 ? "bg-success/10 text-success" : score >= 60 ? "bg-accent/10 text-accent" : "bg-error/10 text-error";
    return <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-semibold", color)}>{score}</span>;
  };

  const columns: Column<Lead>[] = [
    { key: "name", label: t("addLead").replace("Add ", ""), sortable: true },
    { key: "email", label: "Email" },
    { key: "company", label: t("company"), sortable: true },
    { key: "source", label: t("source") },
    { key: "value", label: t("value"), sortable: true },
    { key: "score", label: t("leadScore"), render: (item) => scoreBadge(item.score) },
  ];

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 rounded-lg bg-background p-1">
            <button
              onClick={() => setView("pipeline")}
              className={clsx(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
                view === "pipeline" ? "bg-surface text-primary shadow-sm" : "text-text-secondary"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              {t("pipeline")}
            </button>
            <button
              onClick={() => setView("list")}
              className={clsx(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
                view === "list" ? "bg-surface text-primary shadow-sm" : "text-text-secondary"
              )}
            >
              <List className="h-4 w-4" />
              {t("listView")}
            </button>
          </div>

          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" />
            {t("addLead")}
          </button>
        </div>

        {view === "pipeline" ? (
          <div className="grid gap-4 overflow-x-auto lg:grid-cols-6">
            {stages.map((stage) => {
              const stageLeads = mockLeads.filter((l) => l.stage === stage);
              return (
                <div key={stage} className="min-w-[200px]">
                  <div className={clsx("mb-3 rounded-lg border-s-4 px-3 py-2", stageColors[stage])}>
                    <p className="text-sm font-semibold text-text-primary">{t(stage)}</p>
                    <p className="text-xs text-text-muted">{stageLeads.length} leads</p>
                  </div>
                  <div className="space-y-2">
                    {stageLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="cursor-pointer rounded-lg border border-border bg-surface p-3 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <p className="text-sm font-medium text-text-primary">{lead.name}</p>
                        <p className="mt-0.5 text-xs text-text-muted">{lead.company}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs font-medium text-primary">{lead.value}</span>
                          {scoreBadge(lead.score)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={mockLeads as unknown as Record<string, unknown>[]}
          />
        )}
      </div>

      <Modal open={addOpen} onOpenChange={setAddOpen} title={t("addLead")}>
        <form className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Name</label>
            <input type="text" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Email</label>
            <input type="email" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("company")}</label>
            <input type="text" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("value")}</label>
            <input type="text" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setAddOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover">Cancel</button>
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">{t("addLead")}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
