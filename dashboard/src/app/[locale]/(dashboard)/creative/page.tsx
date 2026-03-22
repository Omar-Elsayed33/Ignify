"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import EmptyState from "@/components/EmptyState";
import { clsx } from "clsx";
import { Sparkles, Upload, Image, LayoutGrid, Stamp, Box, Download, MoreVertical } from "lucide-react";

const mockAssets = [
  { id: "1", name: "Summer Campaign Banner", type: "banner", thumbnail: null, date: "2026-03-20" },
  { id: "2", name: "Product Hero Shot", type: "image", thumbnail: null, date: "2026-03-19" },
  { id: "3", name: "Brand Logo Variant", type: "logo", thumbnail: null, date: "2026-03-18" },
  { id: "4", name: "App Store Mockup", type: "mockup", thumbnail: null, date: "2026-03-17" },
  { id: "5", name: "Social Media Ad", type: "banner", thumbnail: null, date: "2026-03-16" },
  { id: "6", name: "Email Header Image", type: "image", thumbnail: null, date: "2026-03-15" },
  { id: "7", name: "Icon Set v2", type: "logo", thumbnail: null, date: "2026-03-14" },
  { id: "8", name: "Landing Page Mockup", type: "mockup", thumbnail: null, date: "2026-03-13" },
];

const typeIcons: Record<string, React.ElementType> = {
  image: Image,
  banner: LayoutGrid,
  logo: Stamp,
  mockup: Box,
};

export default function CreativePage() {
  const t = useTranslations("creativePage");
  const [filter, setFilter] = useState("all");

  const filters = [
    { value: "all", label: t("allTypes") },
    { value: "image", label: t("image") },
    { value: "banner", label: t("banner") },
    { value: "logo", label: t("logo") },
    { value: "mockup", label: t("mockup") },
  ];

  const filtered = filter === "all" ? mockAssets : mockAssets.filter((a) => a.type === filter);

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 rounded-lg bg-background p-1">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={clsx(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  filter === f.value
                    ? "bg-surface text-primary shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <button className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover">
              <Upload className="h-4 w-4" />
              {t("upload")}
            </button>
            <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
              <Sparkles className="h-4 w-4" />
              {t("generateImage")}
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Image}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            actionLabel={t("generateImage")}
            onAction={() => {}}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((asset) => {
              const TypeIcon = typeIcons[asset.type] || Image;
              return (
                <div
                  key={asset.id}
                  className="group overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-shadow hover:shadow-md"
                >
                  {/* Thumbnail placeholder */}
                  <div className="flex h-44 items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5">
                    <TypeIcon className="h-12 w-12 text-text-muted/40" />
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-text-primary">
                          {asset.name}
                        </p>
                        <p className="mt-0.5 text-xs text-text-muted capitalize">
                          {t(asset.type as "image" | "banner" | "logo" | "mockup")}
                        </p>
                      </div>
                      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button className="rounded-md p-1 text-text-muted hover:bg-surface-hover hover:text-text-primary">
                          <Download className="h-4 w-4" />
                        </button>
                        <button className="rounded-md p-1 text-text-muted hover:bg-surface-hover hover:text-text-primary">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-text-muted">{asset.date}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
