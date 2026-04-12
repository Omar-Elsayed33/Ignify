"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Plus, Edit2, Trash2, Loader2 } from "lucide-react";
import Modal from "@/components/Modal";
import { api } from "@/lib/api";

type Currency = "USD" | "EGP" | "SAR" | "AED";
const CURRENCIES: Currency[] = ["USD", "EGP", "SAR", "AED"];
const FEATURE_KEYS = [
  "analytics",
  "seo",
  "ads",
  "whitelabel",
  "priority",
  "customdomain",
] as const;
type FeatureKey = (typeof FEATURE_KEYS)[number];

interface PlanPriceEntry {
  monthly: number;
  yearly: number;
}

interface PlanRow {
  id: string;
  slug: string;
  name: string;
  prices: Partial<Record<Currency, PlanPriceEntry>>;
  features: Record<string, unknown>;
  max_users: number;
  max_channels: number;
  max_credits: number;
  is_active: boolean;
}

interface FormState {
  id?: string;
  slug: string;
  name: string;
  prices: Record<Currency, PlanPriceEntry>;
  features: Record<FeatureKey, boolean>;
  max_users: number;
  max_channels: number;
  max_credits: number;
  is_active: boolean;
}

function emptyForm(): FormState {
  return {
    slug: "",
    name: "",
    prices: CURRENCIES.reduce(
      (acc, c) => ({ ...acc, [c]: { monthly: 0, yearly: 0 } }),
      {} as Record<Currency, PlanPriceEntry>,
    ),
    features: FEATURE_KEYS.reduce(
      (acc, k) => ({ ...acc, [k]: false }),
      {} as Record<FeatureKey, boolean>,
    ),
    max_users: 5,
    max_channels: 3,
    max_credits: 1000,
    is_active: true,
  };
}

function planToForm(plan: PlanRow): FormState {
  const prices = CURRENCIES.reduce((acc, c) => {
    const p = plan.prices?.[c] ?? { monthly: 0, yearly: 0 };
    return { ...acc, [c]: { monthly: p.monthly ?? 0, yearly: p.yearly ?? 0 } };
  }, {} as Record<Currency, PlanPriceEntry>);
  const featFlags = (plan.features || {}) as Record<string, unknown>;
  const flagsDict = (featFlags.flags as Record<string, boolean>) || {};
  const features = FEATURE_KEYS.reduce(
    (acc, k) => ({ ...acc, [k]: Boolean(flagsDict[k]) }),
    {} as Record<FeatureKey, boolean>,
  );
  return {
    id: plan.id,
    slug: plan.slug,
    name: plan.name,
    prices,
    features,
    max_users: plan.max_users,
    max_channels: plan.max_channels,
    max_credits: plan.max_credits,
    is_active: plan.is_active,
  };
}

export default function AdminPlansPage() {
  const t = useTranslations("adminPlans");
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<PlanRow[]>("/api/v1/admin/plans");
      setPlans(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  function openNew() {
    setForm(emptyForm());
    setModalOpen(true);
  }
  function openEdit(plan: PlanRow) {
    setForm(planToForm(plan));
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const existingFeatures =
        plans.find((p) => p.id === form.id)?.features ?? {};
      const featuresBlob = {
        ...(typeof existingFeatures === "object" ? existingFeatures : {}),
        flags: form.features,
      };
      const payload = {
        name: form.name,
        prices: form.prices,
        features: featuresBlob,
        max_users: form.max_users,
        max_channels: form.max_channels,
        max_credits: form.max_credits,
        is_active: form.is_active,
      };
      if (form.id) {
        await api.patch(`/api/v1/admin/plans/${form.id}`, payload);
      } else {
        await api.post(`/api/v1/admin/plans`, { slug: form.slug, ...payload });
      }
      setModalOpen(false);
      await fetchPlans();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function del(plan: PlanRow) {
    if (!confirm(`Deactivate ${plan.name}?`)) return;
    setDeletingId(plan.id);
    try {
      await api.delete(`/api/v1/admin/plans/${plan.id}`);
      await fetchPlans();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-surface px-6">
        <h1 className="text-xl font-bold text-text-primary">{t("title")}</h1>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
        >
          <Plus className="h-4 w-4" /> {t("new")}
        </button>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}
        <p className="mb-4 text-sm text-text-secondary">{t("subtitle")}</p>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-background text-text-secondary">
                <tr>
                  <th className="p-3 text-start">{t("columns.slug")}</th>
                  <th className="p-3 text-start">{t("columns.name")}</th>
                  {CURRENCIES.map((c) => (
                    <th key={c} className="p-3 text-start">
                      {c}
                    </th>
                  ))}
                  <th className="p-3 text-start">{t("columns.users")}</th>
                  <th className="p-3 text-start">{t("columns.channels")}</th>
                  <th className="p-3 text-start">{t("columns.active")}</th>
                  <th className="p-3 text-end">{t("columns.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-3 font-mono text-xs">{p.slug}</td>
                    <td className="p-3 font-medium">{p.name}</td>
                    {CURRENCIES.map((c) => {
                      const e = p.prices?.[c];
                      return (
                        <td key={c} className="p-3 text-text-secondary">
                          {e
                            ? `${e.monthly ?? 0}/${e.yearly ?? 0}`
                            : "—"}
                        </td>
                      );
                    })}
                    <td className="p-3">{p.max_users}</td>
                    <td className="p-3">{p.max_channels}</td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          p.is_active
                            ? "bg-success/10 text-success"
                            : "bg-error/10 text-error"
                        }`}
                      >
                        {p.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-3 text-end">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="rounded-md p-1.5 text-text-secondary hover:bg-background hover:text-text-primary"
                          aria-label="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => del(p)}
                          disabled={deletingId === p.id}
                          className="rounded-md p-1.5 text-error hover:bg-error/10 disabled:opacity-50"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={form.id ? t("form.save") : t("form.create")}
      >
        <div className="max-h-[70vh] space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-text-secondary">
                {t("form.name")}
              </span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-text-secondary">
                {t("form.slug")}
              </span>
              <input
                value={form.slug}
                disabled={!!form.id}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              />
            </label>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase text-text-secondary">
              {t("form.prices")}
            </div>
            <div className="space-y-2">
              {CURRENCIES.map((c) => (
                <div key={c} className="grid grid-cols-5 items-center gap-2">
                  <span className="text-sm font-medium">{t(`currencies.${c}`)}</span>
                  <label className="col-span-2 text-xs">
                    <span className="text-text-muted">{t("form.monthly")}</span>
                    <input
                      type="number"
                      value={form.prices[c].monthly}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          prices: {
                            ...form.prices,
                            [c]: {
                              ...form.prices[c],
                              monthly: parseFloat(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="col-span-2 text-xs">
                    <span className="text-text-muted">{t("form.yearly")}</span>
                    <input
                      type="number"
                      value={form.prices[c].yearly}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          prices: {
                            ...form.prices,
                            [c]: {
                              ...form.prices[c],
                              yearly: parseFloat(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase text-text-secondary">
              {t("form.features")}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {FEATURE_KEYS.map((k) => (
                <label
                  key={k}
                  className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={form.features[k]}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        features: { ...form.features, [k]: e.target.checked },
                      })
                    }
                  />
                  {t(`features.${k}`)}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase text-text-secondary">
              {t("form.limits")}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <label className="block text-xs">
                <span>{t("form.maxUsers")}</span>
                <input
                  type="number"
                  value={form.max_users}
                  onChange={(e) =>
                    setForm({ ...form, max_users: parseInt(e.target.value) || 0 })
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                />
              </label>
              <label className="block text-xs">
                <span>{t("form.maxChannels")}</span>
                <input
                  type="number"
                  value={form.max_channels}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      max_channels: parseInt(e.target.value) || 0,
                    })
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                />
              </label>
              <label className="block text-xs">
                <span>{t("form.maxCredits")}</span>
                <input
                  type="number"
                  value={form.max_credits}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      max_credits: parseInt(e.target.value) || 0,
                    })
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                />
              </label>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) =>
                setForm({ ...form, is_active: e.target.checked })
              }
            />
            {t("form.active")}
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
          <button
            onClick={() => setModalOpen(false)}
            className="rounded-lg border border-border px-4 py-2 text-sm"
          >
            {t("form.cancel")}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {form.id ? t("form.save") : t("form.create")}
          </button>
        </div>
      </Modal>
    </div>
  );
}
