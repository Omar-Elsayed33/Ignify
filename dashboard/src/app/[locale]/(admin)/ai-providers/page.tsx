"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import DataTable, { Column } from "@/components/DataTable";
import Modal from "@/components/Modal";
import { Plus, Cpu } from "lucide-react";
import { clsx } from "clsx";

interface AIProvider {
  name: string;
  models: string;
  apiStatus: string;
  requests: string;
  cost: string;
  [key: string]: unknown;
}

const mockProviders: AIProvider[] = [
  { name: "OpenAI", models: "GPT-4o, GPT-4o-mini, DALL-E 3", apiStatus: "active", requests: "125,430", cost: "$2,340" },
  { name: "Anthropic", models: "Claude 3.5 Sonnet, Claude 3 Haiku", apiStatus: "active", requests: "89,210", cost: "$1,780" },
  { name: "Google AI", models: "Gemini 2.0, Gemini 1.5 Pro", apiStatus: "active", requests: "45,890", cost: "$890" },
  { name: "Stability AI", models: "SDXL, SD3", apiStatus: "inactive", requests: "12,340", cost: "$340" },
  { name: "Cohere", models: "Command R+, Embed v3", apiStatus: "active", requests: "23,450", cost: "$450" },
];

export default function AIProvidersPage() {
  const t = useTranslations("admin");
  const [addOpen, setAddOpen] = useState(false);

  const columns: Column<AIProvider>[] = [
    {
      key: "name",
      label: t("providerName"),
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-primary/10 p-1.5">
            <Cpu className="h-4 w-4 text-primary" />
          </div>
          <span className="font-medium">{item.name}</span>
        </div>
      ),
    },
    { key: "models", label: t("models") },
    {
      key: "apiStatus",
      label: t("apiStatus"),
      render: (item) => (
        <span
          className={clsx(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            item.apiStatus === "active" ? "bg-success/10 text-success" : "bg-error/10 text-error"
          )}
        >
          {item.apiStatus}
        </span>
      ),
    },
    { key: "requests", label: "Total Requests", sortable: true },
    { key: "cost", label: "Total Cost", sortable: true },
  ];

  return (
    <div>
      <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-surface px-6">
        <h1 className="text-xl font-bold text-text-primary">{t("aiProviders")}</h1>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
        >
          <Plus className="h-4 w-4" />
          {t("addProvider")}
        </button>
      </div>

      <div className="p-6">
        <DataTable
          columns={columns}
          data={mockProviders as unknown as Record<string, unknown>[]}
        />
      </div>

      <Modal open={addOpen} onOpenChange={setAddOpen} title={t("addProvider")}>
        <form className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("providerName")}</label>
            <input type="text" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">API Key</label>
            <input type="password" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Base URL</label>
            <input type="url" placeholder="https://api.openai.com/v1" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setAddOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover">Cancel</button>
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">{t("addProvider")}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
