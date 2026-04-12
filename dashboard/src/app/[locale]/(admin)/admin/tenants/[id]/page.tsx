"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { api } from "@/lib/api";

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  plan_name: string | null;
  is_active: boolean;
  user_count: number;
  plan_count: number;
  agent_run_count: number;
  created_at: string;
  onboarding_completed: boolean;
}

interface PlanRow {
  id: string;
  title: string;
  status: string;
  version: number;
  created_at: string;
}

interface RunRow {
  id: string;
  agent_name: string;
  model: string | null;
  status: string;
  cost_usd: number | null;
  latency_ms: number | null;
  started_at: string;
}

interface AgentConfigRow {
  tenant_id: string;
  agent_name: string;
  model: string | null;
  is_enabled: boolean;
  system_prompt_set: boolean;
  temperature: number | null;
}

const MODEL_CHOICES = [
  "anthropic/claude-sonnet-4-5",
  "anthropic/claude-opus-4-1",
  "anthropic/claude-haiku-4-5",
  "openai/gpt-4o",
  "google/gemini-2.0-flash-exp",
  "perplexity/sonar-pro",
];

type TabKey = "overview" | "plans" | "runs" | "configs";

export default function AdminTenantDetailPage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const t = useTranslations("adminTenant");
  const tDash = useTranslations("adminDash");

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [configs, setConfigs] = useState<AgentConfigRow[]>([]);
  const [tab, setTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit dialog state
  const [editing, setEditing] = useState<AgentConfigRow | null>(null);
  const [editModel, setEditModel] = useState("");
  const [editCustomModel, setEditCustomModel] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editTemp, setEditTemp] = useState<number>(0.7);
  const [editEnabled, setEditEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [d, p, r, c] = await Promise.all([
        api.get<TenantDetail>(`/api/v1/admin/tenants/${id}/detail`),
        api.get<PlanRow[]>(`/api/v1/admin/tenants/${id}/plans`),
        api.get<RunRow[]>(`/api/v1/admin/tenants/${id}/agent-runs`),
        api.get<AgentConfigRow[]>(`/api/v1/admin/tenants/${id}/agent-configs`),
      ]);
      setTenant(d);
      setPlans(p);
      setRuns(r);
      setConfigs(c);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openEdit = (cfg: AgentConfigRow) => {
    setEditing(cfg);
    const currentModel = cfg.model ?? "";
    if (MODEL_CHOICES.includes(currentModel)) {
      setEditModel(currentModel);
      setEditCustomModel("");
    } else {
      setEditModel("__custom__");
      setEditCustomModel(currentModel);
    }
    setEditPrompt("");
    setEditTemp(cfg.temperature ?? 0.7);
    setEditEnabled(cfg.is_enabled);
    setSavedMsg(null);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    setSavedMsg(null);
    try {
      const modelValue = editModel === "__custom__" ? editCustomModel : editModel;
      const payload: Record<string, unknown> = {
        model: modelValue || null,
        temperature: editTemp,
        is_enabled: editEnabled,
      };
      if (editPrompt) payload.system_prompt = editPrompt;
      const updated = await api.put<AgentConfigRow>(
        `/api/v1/admin/tenants/${id}/agent-configs/${editing.agent_name}`,
        payload
      );
      setConfigs((prev) =>
        prev.map((c) => (c.agent_name === updated.agent_name ? updated : c))
      );
      setSavedMsg(t("configs.saved"));
      setTimeout(() => setEditing(null), 700);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="sticky top-0 z-30 flex h-16 items-center border-b border-border bg-surface px-6">
        <h1 className="text-xl font-bold text-text-primary">
          {tenant?.name ?? "Tenant"}
        </h1>
      </div>

      <div className="p-6 space-y-6">
        {error && (
          <div className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-2 border-b border-border">
              {(["overview", "plans", "runs", "configs"] as TabKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={clsx(
                    "px-4 py-2 text-sm font-medium",
                    tab === k
                      ? "border-b-2 border-primary text-primary"
                      : "text-text-muted hover:text-text-primary"
                  )}
                >
                  {t(`tabs.${k}`)}
                </button>
              ))}
            </div>

            {tab === "overview" && tenant && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <InfoCard label="Slug" value={tenant.slug} />
                <InfoCard label="Plan" value={tenant.plan_name ?? "—"} />
                <InfoCard label="Users" value={String(tenant.user_count)} />
                <InfoCard label="Plans" value={String(tenant.plan_count)} />
                <InfoCard label="Agent runs" value={String(tenant.agent_run_count)} />
                <InfoCard
                  label="Status"
                  value={tenant.is_active ? "Active" : "Inactive"}
                />
                <InfoCard
                  label="Onboarded"
                  value={tenant.onboarding_completed ? "Yes" : "No"}
                />
                <InfoCard
                  label="Created"
                  value={new Date(tenant.created_at).toLocaleDateString()}
                />
              </div>
            )}

            {tab === "plans" && (
              <section className="rounded-xl border border-border bg-surface">
                {plans.length === 0 ? (
                  <div className="p-6 text-center text-sm text-text-muted">
                    {tDash("plans.empty")}
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-background/50 text-xs uppercase text-text-muted">
                      <tr>
                        <th className="px-5 py-2 text-start">{tDash("plans.planTitle")}</th>
                        <th className="px-5 py-2 text-start">{tDash("plans.status")}</th>
                        <th className="px-5 py-2 text-start">Version</th>
                        <th className="px-5 py-2 text-start">{tDash("plans.created")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plans.map((p) => (
                        <tr key={p.id} className="border-b border-border last:border-0">
                          <td className="px-5 py-2">{p.title}</td>
                          <td className="px-5 py-2">{p.status}</td>
                          <td className="px-5 py-2">v{p.version}</td>
                          <td className="px-5 py-2 text-text-muted">
                            {new Date(p.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            )}

            {tab === "runs" && (
              <section className="rounded-xl border border-border bg-surface">
                {runs.length === 0 ? (
                  <div className="p-6 text-center text-sm text-text-muted">
                    {tDash("runs.empty")}
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-background/50 text-xs uppercase text-text-muted">
                      <tr>
                        <th className="px-5 py-2 text-start">{tDash("runs.agent")}</th>
                        <th className="px-5 py-2 text-start">{tDash("runs.model")}</th>
                        <th className="px-5 py-2 text-start">{tDash("runs.status")}</th>
                        <th className="px-5 py-2 text-end">{tDash("runs.cost")}</th>
                        <th className="px-5 py-2 text-end">{tDash("runs.latency")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runs.map((r) => (
                        <tr key={r.id} className="border-b border-border last:border-0">
                          <td className="px-5 py-2 font-medium">{r.agent_name}</td>
                          <td className="px-5 py-2 text-text-muted">{r.model ?? "—"}</td>
                          <td className="px-5 py-2">{r.status}</td>
                          <td className="px-5 py-2 text-end">
                            {r.cost_usd != null ? `$${Number(r.cost_usd).toFixed(4)}` : "—"}
                          </td>
                          <td className="px-5 py-2 text-end text-text-muted">
                            {r.latency_ms ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            )}

            {tab === "configs" && (
              <section className="rounded-xl border border-border bg-surface">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-background/50 text-xs uppercase text-text-muted">
                    <tr>
                      <th className="px-5 py-2 text-start">{t("configs.agent")}</th>
                      <th className="px-5 py-2 text-start">{t("configs.model")}</th>
                      <th className="px-5 py-2 text-start">{t("configs.systemPrompt")}</th>
                      <th className="px-5 py-2 text-start">{t("configs.enabled")}</th>
                      <th className="px-5 py-2 text-end"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {configs.map((c) => (
                      <tr key={c.agent_name} className="border-b border-border last:border-0">
                        <td className="px-5 py-2 font-medium">{c.agent_name}</td>
                        <td className="px-5 py-2 text-text-muted">{c.model ?? "—"}</td>
                        <td className="px-5 py-2">
                          {c.system_prompt_set ? (
                            <span className="rounded-full bg-info/10 px-2 py-0.5 text-xs text-info">
                              custom
                            </span>
                          ) : (
                            <span className="text-text-muted text-xs">default</span>
                          )}
                        </td>
                        <td className="px-5 py-2">
                          {c.is_enabled ? (
                            <span className="text-success text-xs">Yes</span>
                          ) : (
                            <span className="text-error text-xs">No</span>
                          )}
                        </td>
                        <td className="px-5 py-2 text-end">
                          <button
                            onClick={() => openEdit(c)}
                            className="rounded-lg border border-primary/30 px-3 py-1 text-xs text-primary hover:bg-primary/10"
                          >
                            {t("configs.override")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </>
        )}

        {/* Edit modal */}
        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-xl bg-surface p-6 shadow-xl">
              <h3 className="mb-4 text-lg font-semibold">
                {editing.agent_name} — {t("configs.override")}
              </h3>

              <label className="mb-1 block text-xs font-medium">{t("configs.model")}</label>
              <select
                value={editModel}
                onChange={(e) => setEditModel(e.target.value)}
                className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {MODEL_CHOICES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                <option value="__custom__">{t("configs.customModel")}…</option>
              </select>
              {editModel === "__custom__" && (
                <input
                  value={editCustomModel}
                  onChange={(e) => setEditCustomModel(e.target.value)}
                  placeholder="provider/model-id"
                  className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              )}

              <label className="mb-1 block text-xs font-medium">
                {t("configs.systemPrompt")}
              </label>
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                rows={4}
                className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="(optional — leave blank to keep existing)"
              />

              <label className="mb-1 block text-xs font-medium">
                {t("configs.temperature")}: {editTemp.toFixed(2)}
              </label>
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={editTemp}
                onChange={(e) => setEditTemp(Number(e.target.value))}
                className="mb-3 w-full"
              />

              <label className="mb-4 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editEnabled}
                  onChange={(e) => setEditEnabled(e.target.checked)}
                />
                {t("configs.enabled")}
              </label>

              {savedMsg && (
                <div className="mb-3 rounded-lg bg-success/10 px-3 py-2 text-xs text-success">
                  {savedMsg}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditing(null)}
                  className="rounded-lg border border-border px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {saving ? "…" : t("configs.save")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-base font-semibold text-text-primary">{value}</p>
    </div>
  );
}
