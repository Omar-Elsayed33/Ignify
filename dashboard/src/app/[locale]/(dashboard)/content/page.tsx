"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import DataTable, { Column } from "@/components/DataTable";
import Modal from "@/components/Modal";
import * as Tabs from "@radix-ui/react-tabs";
import { Plus, FileText } from "lucide-react";
import { clsx } from "clsx";

interface ContentItem {
  id: string;
  title: string;
  type: string;
  platform: string;
  status: "draft" | "scheduled" | "published";
  lastModified: string;
  [key: string]: unknown;
}

const mockContent: ContentItem[] = [
  { id: "1", title: "AI Marketing Trends 2026", type: "Blog", platform: "Website", status: "published", lastModified: "2026-03-20" },
  { id: "2", title: "Summer Sale Announcement", type: "Email", platform: "Mailchimp", status: "scheduled", lastModified: "2026-03-19" },
  { id: "3", title: "New Product Launch Post", type: "Social", platform: "Instagram", status: "draft", lastModified: "2026-03-18" },
  { id: "4", title: "Weekly Newsletter #42", type: "Email", platform: "Mailchimp", status: "published", lastModified: "2026-03-17" },
  { id: "5", title: "Brand Story Video Script", type: "Ad Copy", platform: "YouTube", status: "draft", lastModified: "2026-03-16" },
  { id: "6", title: "Customer Success Story", type: "Blog", platform: "Website", status: "published", lastModified: "2026-03-15" },
  { id: "7", title: "Flash Sale Carousel", type: "Social", platform: "Facebook", status: "scheduled", lastModified: "2026-03-14" },
  { id: "8", title: "Product Feature Highlight", type: "Ad Copy", platform: "Google Ads", status: "published", lastModified: "2026-03-13" },
];

export default function ContentPage() {
  const t = useTranslations("contentPage");
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-text-muted/10 text-text-muted",
      scheduled: "bg-accent/10 text-accent",
      published: "bg-success/10 text-success",
    };
    const labels: Record<string, string> = {
      draft: t("draft"),
      scheduled: t("scheduled"),
      published: t("published"),
    };
    return (
      <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", colors[status])}>
        {labels[status]}
      </span>
    );
  };

  const columns: Column<ContentItem>[] = [
    { key: "title", label: t("contentTitle"), sortable: true },
    { key: "type", label: t("contentType"), sortable: true },
    { key: "platform", label: t("platform"), sortable: true },
    {
      key: "status",
      label: t("status"),
      render: (item) => statusBadge(item.status),
    },
    { key: "lastModified", label: t("lastModified"), sortable: true },
  ];

  const filteredContent = activeTab === "all"
    ? mockContent
    : mockContent.filter((c) => c.type.toLowerCase() === activeTab);

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
            <Tabs.List className="flex gap-1 rounded-lg bg-background p-1">
              {[
                { value: "all", label: t("allContent") },
                { value: "blog", label: t("blog") },
                { value: "social", label: t("socialTab") },
                { value: "email", label: t("emailTab") },
                { value: "ad copy", label: t("adCopy") },
              ].map((tab) => (
                <Tabs.Trigger
                  key={tab.value}
                  value={tab.value}
                  className={clsx(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    activeTab === tab.value
                      ? "bg-surface text-primary shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  )}
                >
                  {tab.label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Tabs.Root>

          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" />
            {t("createContent")}
          </button>
        </div>

        <DataTable
          columns={columns}
          data={filteredContent as unknown as Record<string, unknown>[]}
          emptyTitle={t("emptyTitle")}
          emptyDescription={t("emptyDescription")}
        />
      </div>

      <Modal open={createOpen} onOpenChange={setCreateOpen} title={t("createContent")}>
        <form className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("contentTitle")}
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("contentType")}
            </label>
            <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
              <option>Blog</option>
              <option>Social</option>
              <option>Email</option>
              <option>Ad Copy</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("platform")}
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
            >
              {t("createContent")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
