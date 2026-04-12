"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import DataTable, { Column } from "@/components/DataTable";
import { Link } from "@/i18n/navigation";
import { clsx } from "clsx";
import { api } from "@/lib/api";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  plan_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export default function TenantsPage() {
  const t = useTranslations("admin");
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchTenants = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<TenantRow[]>("/api/v1/admin/tenants")
      .then((data) => setTenants(data))
      .catch((err) => setError(err.message ?? "Failed to load tenants"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const toggleStatus = async (tenant: TenantRow) => {
    setTogglingId(tenant.id);
    try {
      const updated = await api.put<TenantRow>(
        `/api/v1/admin/tenants/${tenant.id}`,
        { is_active: !tenant.is_active }
      );
      setTenants((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update tenant";
      setError(msg);
    } finally {
      setTogglingId(null);
    }
  };

  const columns: Column<TenantRow>[] = [
    {
      key: "name",
      label: t("tenantName"),
      sortable: true,
      render: (item) => (
        <Link href={`/admin/tenants/${item.id}`} className="text-primary hover:underline">
          {item.name}
        </Link>
      ),
    },
    { key: "slug", label: "Slug", sortable: true },
    {
      key: "created_at",
      label: t("createdAt"),
      sortable: true,
      render: (item) =>
        new Date(item.created_at).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
    },
    {
      key: "is_active",
      label: "Status",
      render: (item) => (
        <span
          className={clsx(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            item.is_active
              ? "bg-success/10 text-success"
              : "bg-error/10 text-error"
          )}
        >
          {item.is_active ? t("active") : t("inactive")}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (item) => (
        <button
          onClick={() => toggleStatus(item)}
          disabled={togglingId === item.id}
          className={clsx(
            "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
            item.is_active
              ? "border border-error/30 text-error hover:bg-error/10"
              : "border border-success/30 text-success hover:bg-success/10"
          )}
        >
          {togglingId === item.id ? (
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : item.is_active ? (
            t("deactivate")
          ) : (
            t("activate")
          )}
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="sticky top-0 z-30 flex h-16 items-center border-b border-border bg-surface px-6">
        <h1 className="text-xl font-bold text-text-primary">{t("tenantManagement")}</h1>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={tenants as unknown as Record<string, unknown>[]}
            emptyTitle={t("noTenants")}
            emptyDescription={t("noTenantsDescription")}
          />
        )}
      </div>
    </div>
  );
}
