"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Workflow, ArrowRight, Zap, BarChart2, Brain, Save, RotateCcw, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { clsx } from "clsx";
import { useConfirm } from "@/components/ConfirmDialog";

interface AgentListItem {
  name: string;
  default_model: string;
  description: string | null;
  sub_agents: string[];
}

type PlanMode = "fast" | "medium" | "deep";

interface SubagentAssignment {
  subagent_name: string;
  model: string;
}

type ModeConfigs = Record<PlanMode, SubagentAssignment[]>;

const MODE_META: Record<PlanMode, { icon: React.ReactNode; color: string; label: string }> = {
  fast:   { icon: <Zap className="h-4 w-4" />,       color: "text-amber-500",  label: "Fast" },
  medium: { icon: <BarChart2 className="h-4 w-4" />, color: "text-blue-500",   label: "Medium" },
  deep:   { icon: <Brain className="h-4 w-4" />,     color: "text-purple-500", label: "Deep" },
};

// Common OpenRouter model IDs for the dropdown
const MODEL_OPTIONS = [
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
  "anthropic/claude-opus-4-6",
  "anthropic/claude-sonnet-4-6",
  "anthropic/claude-sonnet-4-5",
  "anthropic/claude-haiku-4-5-20251001",
];

export default function AdminAgentsPage() {
  const t = useTranslations("adminAgents");
  const confirm = useConfirm();

  // ── Agents list ──
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [agentsError, setAgentsError] = useState<string | null>(null);

  // ── Plan modes ──
  const [modeConfigs, setModeConfigs] = useState<ModeConfigs>({ fast: [], medium: [], deep: [] });
  const [activeMode, setActiveMode] = useState<PlanMode>("fast");
  const [loadingModes, setLoadingModes] = useState(true);
  const [savingMode, setSavingMode] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [modeError, setModeError] = useState<string | null>(null);
  const [modeSaved, setModeSaved] = useState(false);

  useEffect(() => {
    api
      .get<AgentListItem[]>("/api/v1/admin/agents/list")
      .then(setAgents)
      .catch((e) => setAgentsError(e?.message ?? "Failed"))
      .finally(() => setLoadingAgents(false));

    api
      .get<ModeConfigs>("/api/v1/admin/plan-modes")
      .then(setModeConfigs)
      .catch(() => {})
      .finally(() => setLoadingModes(false));
  }, []);

  function updateModel(subagentName: string, model: string) {
    setModeConfigs((prev) => ({
      ...prev,
      [activeMode]: prev[activeMode].map((a) =>
        a.subagent_name === subagentName ? { ...a, model } : a
      ),
    }));
  }

  async function saveMode() {
    setSavingMode(true);
    setModeError(null);
    setModeSaved(false);
    try {
      const updated = await api.put<SubagentAssignment[]>(`/api/v1/admin/plan-modes/${activeMode}`, {
        assignments: modeConfigs[activeMode],
      });
      setModeConfigs((prev) => ({ ...prev, [activeMode]: updated }));
      setModeSaved(true);
      setTimeout(() => setModeSaved(false), 2500);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setModeError(err?.message ?? "Save failed");
    } finally {
      setSavingMode(false);
    }
  }

  async function resetModes() {
    const ok = await confirm({
      title: "Reset modes",
      description: "Reset all mode configs to defaults?",
      kind: "danger",
      confirmLabel: "Reset",
      cancelLabel: "Cancel",
    });
    if (!ok) return;
    setResetting(true);
    setModeError(null);
    try {
      await api.post("/api/v1/admin/plan-modes/reset", {});
      const fresh = await api.get<ModeConfigs>("/api/v1/admin/plan-modes");
      setModeConfigs(fresh);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setModeError(err?.message ?? "Reset failed");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div>
      <div className="sticky top-0 z-30 flex h-16 items-center border-b border-border bg-surface px-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">{t("title")}</h1>
          <p className="text-xs text-text-muted">{t("subtitle")}</p>
        </div>
      </div>

      <div className="p-6 space-y-10">

        {/* ── Plan Mode Config ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-text-primary">Plan Generation Modes</h2>
              <p className="text-xs text-text-muted mt-0.5">
                Set which AI model each subagent uses per mode. Users only see the mode name.
              </p>
            </div>
            <button
              onClick={resetModes}
              disabled={resetting}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-container transition-colors"
            >
              {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Reset to Defaults
            </button>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-2">
            {(["fast", "medium", "deep"] as PlanMode[]).map((mode) => {
              const meta = MODE_META[mode];
              return (
                <button
                  key={mode}
                  onClick={() => setActiveMode(mode)}
                  className={clsx(
                    "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all",
                    activeMode === mode
                      ? "bg-primary text-white shadow-sm"
                      : "bg-surface-container-low text-text-secondary hover:bg-surface-container"
                  )}
                >
                  <span className={activeMode === mode ? "text-white" : meta.color}>{meta.icon}</span>
                  {meta.label}
                </button>
              );
            })}
          </div>

          {modeError && (
            <div className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
              {modeError}
            </div>
          )}

          {/* Subagent table */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            {loadingModes ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-container-low">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Subagent
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Model
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(modeConfigs[activeMode] ?? []).map((assignment) => (
                    <tr key={assignment.subagent_name} className="hover:bg-surface-container-low/50">
                      <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                        {assignment.subagent_name}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={assignment.model}
                          onChange={(e) => updateModel(assignment.subagent_name, e.target.value)}
                          className="w-full rounded-lg border border-border bg-surface-container-low px-3 py-1.5 text-xs text-text-primary outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          {MODEL_OPTIONS.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                          {/* Keep current value if not in list */}
                          {!MODEL_OPTIONS.includes(assignment.model) && (
                            <option value={assignment.model}>{assignment.model}</option>
                          )}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            {modeSaved && (
              <span className="text-xs font-semibold text-emerald-600">Saved!</span>
            )}
            <button
              onClick={saveMode}
              disabled={savingMode || loadingModes}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {savingMode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save {MODE_META[activeMode].label} Mode
            </button>
          </div>
        </section>

        {/* ── Agents List ── */}
        <section className="space-y-4">
          <h2 className="text-base font-bold text-text-primary">Registered Agents</h2>

          {agentsError && (
            <div className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
              {agentsError}
            </div>
          )}

          {loadingAgents ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : agents.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-text-muted">
              {t("list.empty")}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {agents.map((a) => (
                <div
                  key={a.name}
                  className="flex flex-col rounded-xl border border-border bg-surface p-5"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Workflow className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold capitalize text-text-primary">
                          {a.name}
                        </h3>
                        <p className="text-xs text-text-muted">{a.default_model}</p>
                      </div>
                    </div>
                  </div>

                  {a.description && (
                    <p className="mb-4 line-clamp-3 text-sm text-text-secondary">
                      {a.description}
                    </p>
                  )}

                  <div className="mb-4 flex items-center gap-2 text-xs text-text-muted">
                    <span className="rounded-full bg-background px-2 py-0.5">
                      {a.sub_agents.length} {t("list.subAgents")}
                    </span>
                  </div>

                  {a.sub_agents.length > 0 && (
                    <ul className="mb-4 flex flex-wrap gap-1.5">
                      {a.sub_agents.slice(0, 6).map((sa) => (
                        <li
                          key={sa}
                          className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-text-secondary"
                        >
                          {sa}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-auto">
                    <Link
                      href={`/admin/agents/${a.name}`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                      {t("list.viewGraph")}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
