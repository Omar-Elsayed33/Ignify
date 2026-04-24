"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import DataTable, { Column } from "@/components/DataTable";
import Modal from "@/components/Modal";
import { Plus, Cpu } from "lucide-react";
import { clsx } from "clsx";
import { api } from "@/lib/api";

interface AIProviderRow {
  id: string;
  name: string;
  slug: string;
  provider_type: string;
  api_base_url: string | null;
  default_model: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  [key: string]: unknown;
}

interface AddProviderForm {
  name: string;
  slug: string;
  provider_type: string;
  api_base_url: string;
  default_model: string;
  is_active: boolean;
  is_default: boolean;
}

const EMPTY_FORM: AddProviderForm = {
  name: "",
  slug: "",
  provider_type: "openai",
  api_base_url: "",
  default_model: "",
  is_active: true,
  is_default: false,
};

// Known provider_type values from the backend ProviderType enum
const PROVIDER_TYPES = ["openai", "anthropic", "google", "azure", "cohere", "custom"];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export default function AIProvidersPage() {
  const t = useTranslations("admin");
  const [providers, setProviders] = useState<AIProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<AddProviderForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchProviders = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<AIProviderRow[]>("/api/v1/admin/ai-providers")
      .then((data) => setProviders(data))
      .catch((err) => setError(err.message ?? "Failed to load providers"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const toggleActive = async (provider: AIProviderRow) => {
    setTogglingId(provider.id);
    try {
      const updated = await api.put<AIProviderRow>(
        `/api/v1/admin/ai-providers/${provider.id}`,
        {
          name: provider.name,
          slug: provider.slug,
          provider_type: provider.provider_type,
          api_base_url: provider.api_base_url,
          default_model: provider.default_model,
          is_active: !provider.is_active,
          is_default: provider.is_default,
        }
      );
      setProviders((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update provider";
      setError(msg);
    } finally {
      setTogglingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.name.trim() || !form.slug.trim() || !form.provider_type) {
      setFormError(t("fillRequiredFields"));
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.post<AIProviderRow>("/api/v1/admin/ai-providers", {
        name: form.name.trim(),
        slug: form.slug.trim(),
        provider_type: form.provider_type,
        api_base_url: form.api_base_url.trim() || null,
        default_model: form.default_model.trim() || null,
        is_active: form.is_active,
        is_default: form.is_default,
      });
      setProviders((prev) => [created, ...prev]);
      setAddOpen(false);
      setForm(EMPTY_FORM);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add provider";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<AIProviderRow>[] = [
    {
      key: "name",
      label: t("providerName"),
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-primary/10 p-1.5">
            <Cpu className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="font-medium">{item.name}</span>
            {item.is_default && (
              <span className="ms-2 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                {t("default")}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "provider_type",
      label: t("providerType"),
      render: (item) => (
        <span className="rounded-md bg-surface-hover px-2 py-0.5 font-mono text-xs text-text-secondary">
          {item.provider_type}
        </span>
      ),
    },
    {
      key: "default_model",
      label: t("defaultModel"),
      render: (item) => (
        <span className="text-sm text-text-secondary">
          {item.default_model ?? "—"}
        </span>
      ),
    },
    {
      key: "api_base_url",
      label: "Base URL",
      render: (item) => (
        <span className="max-w-xs truncate text-sm text-text-muted">
          {item.api_base_url ?? "—"}
        </span>
      ),
    },
    {
      key: "is_active",
      label: t("apiStatus"),
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
          onClick={() => toggleActive(item)}
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
      <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-surface px-6">
        <h1 className="text-xl font-bold text-text-primary">{t("aiProviders")}</h1>
        <button
          onClick={() => { setForm(EMPTY_FORM); setFormError(null); setAddOpen(true); }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
        >
          <Plus className="h-4 w-4" />
          {t("addProvider")}
        </button>
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
            data={providers}
            emptyTitle={t("noProviders")}
            emptyDescription={t("noProvidersDescription")}
          />
        )}
      </div>

      <Modal
        open={addOpen}
        onOpenChange={(open) => { setAddOpen(open); if (!open) setFormError(null); }}
        title={t("addProvider")}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
              {formError}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("providerName")} <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((f) => ({ ...f, name, slug: slugify(name) }));
              }}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              Slug <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("providerType")} <span className="text-error">*</span>
            </label>
            <select
              value={form.provider_type}
              onChange={(e) => setForm((f) => ({ ...f, provider_type: e.target.value }))}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {PROVIDER_TYPES.map((pt) => (
                <option key={pt} value={pt}>
                  {pt.charAt(0).toUpperCase() + pt.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              Base URL
            </label>
            <input
              type="url"
              value={form.api_base_url}
              onChange={(e) => setForm((f) => ({ ...f, api_base_url: e.target.value }))}
              placeholder="https://api.openai.com/v1"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("defaultModel")}
            </label>
            <input
              type="text"
              value={form.default_model}
              onChange={(e) => setForm((f) => ({ ...f, default_model: e.target.value }))}
              placeholder="gpt-4o"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              {t("active")}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              {t("default")}
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {submitting && (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              {t("addProvider")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
