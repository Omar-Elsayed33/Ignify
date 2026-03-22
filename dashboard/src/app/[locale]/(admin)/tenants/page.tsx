"use client";

import { useTranslations } from "next-intl";
import DataTable, { Column } from "@/components/DataTable";
import { clsx } from "clsx";

interface TenantRow {
  name: string;
  slug: string;
  plan: string;
  users: number;
  createdAt: string;
  status: string;
  [key: string]: unknown;
}

const mockTenants: TenantRow[] = [
  { name: "Acme Corp", slug: "acme-corp", plan: "Enterprise", users: 24, createdAt: "2025-08-15", status: "active" },
  { name: "TechStart", slug: "techstart", plan: "Pro", users: 8, createdAt: "2025-09-22", status: "active" },
  { name: "GlobalMedia", slug: "globalmedia", plan: "Pro", users: 12, createdAt: "2025-10-01", status: "active" },
  { name: "SmallBiz Co", slug: "smallbiz", plan: "Starter", users: 3, createdAt: "2025-11-10", status: "active" },
  { name: "InnovateSA", slug: "innovate-sa", plan: "Enterprise", users: 35, createdAt: "2025-12-05", status: "active" },
  { name: "DesignHub", slug: "designhub", plan: "Pro", users: 6, createdAt: "2026-01-15", status: "inactive" },
  { name: "MarketForce", slug: "marketforce", plan: "Starter", users: 2, createdAt: "2026-02-01", status: "active" },
  { name: "DataDriven", slug: "datadriven", plan: "Pro", users: 10, createdAt: "2026-03-01", status: "active" },
];

const planColors: Record<string, string> = {
  Starter: "bg-text-muted/10 text-text-muted",
  Pro: "bg-primary/10 text-primary",
  Enterprise: "bg-accent/10 text-accent",
};

export default function TenantsPage() {
  const t = useTranslations("admin");

  const columns: Column<TenantRow>[] = [
    { key: "name", label: t("tenantName"), sortable: true },
    {
      key: "plan",
      label: t("plan"),
      render: (item) => (
        <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", planColors[item.plan])}>
          {item.plan}
        </span>
      ),
    },
    { key: "users", label: t("users"), sortable: true },
    { key: "createdAt", label: t("createdAt"), sortable: true },
    {
      key: "status",
      label: "Status",
      render: (item) => (
        <span
          className={clsx(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            item.status === "active" ? "bg-success/10 text-success" : "bg-error/10 text-error"
          )}
        >
          {item.status}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="sticky top-0 z-30 flex h-16 items-center border-b border-border bg-surface px-6">
        <h1 className="text-xl font-bold text-text-primary">{t("tenantManagement")}</h1>
      </div>

      <div className="p-6">
        <DataTable
          columns={columns}
          data={mockTenants as unknown as Record<string, unknown>[]}
        />
      </div>
    </div>
  );
}
