"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { Brain } from "lucide-react";
import { api } from "@/lib/api";

interface AgentConfigItem {
  agent_name: string;
  model: string;
  system_prompt: string | null;
  temperature: number | null;
  max_tokens: number | null;
  is_enabled: boolean;
  is_overridden: boolean;
}

const MODEL_CHOICES = [
  "openai/gpt-4o-mini",
  "openai/gpt-4o",
  "google/gemini-2.0-flash-exp",
  "google/gemini-flash-1.5",
  "anthropic/claude-3.5-sonnet",
  "anthropic/claude-3.5-haiku",
  "meta-llama/llama-3.3-70b-instruct",
  "perplexity/sonar-pro",
];

export default function AiAgentsSettingsPage() {
  const t = useTranslations("aiAgents");
  const [items, setItems] = useState<AgentConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState<AgentConfigItem | null>(null);
  const [model, setModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState<number | "">("");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<AgentConfigItem[]>("/api/v1/agent-configs");
      setItems(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openEdit = (a: AgentConfigItem) => {
    setEditing(a);
    if (MODEL_CHOICES.includes(a.model)) {
      setModel(a.model);
      setCustomModel("");
    } else {
      setModel("__custom__");
      setCustomModel(a.model);
    }
    setPrompt(a.system_prompt ?? "");
    setTemperature(a.temperature ?? 0.7);
    setMaxTokens(a.max_tokens ?? "");
    setEnabled(a.is_enabled);
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const modelValue = model === "__custom__" ? customModel : model;
      const payload: Record<string, unknown> = {
        model: modelValue || null,
        system_prompt: prompt || null,
        temperature,
        is_enabled: enabled,
      };
      if (maxTokens !== "") payload.max_tokens = Number(maxTokens);
      const updated = await api.put<AgentConfigItem>(
        `/api/v1/agent-configs/${editing.agent_name}`,
        payload
      );
      setItems((prev) =>
        prev.map((p) => (p.agent_name === updated.agent_name ? updated : p))
      );
      setEditing(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("errors.failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="sticky top-0 z-30 flex h-16 items-center border-b border-border bg-surface px-6">
        <div className="flex items-center gap-3">
          <Brain className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-text-primary">{t("title")}</h1>
            <p className="text-xs text-text-muted">{t("subtitle")}</p>
          </div>
        </div>
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
          <div className="rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-background/50 text-xs uppercase text-text-muted">
                <tr>
                  <th className="px-5 py-2 text-start">{t("table.agent")}</th>
                  <th className="px-5 py-2 text-start">{t("table.currentModel")}</th>
                  <th className="px-5 py-2 text-start">{t("table.temperature")}</th>
                  <th className="px-5 py-2 text-start">{t("table.status")}</th>
                  <th className="px-5 py-2 text-end">{t("table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr
                    key={a.agent_name}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-5 py-3 font-medium capitalize">
                      {a.agent_name}
                    </td>
                    <td className="px-5 py-3 text-text-muted">{a.model}</td>
                    <td className="px-5 py-3 text-text-muted">
                      {a.temperature != null ? a.temperature.toFixed(2) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={clsx(
                          "rounded-full px-2 py-0.5 text-xs",
                          !a.is_enabled
                            ? "bg-error/10 text-error"
                            : a.is_overridden
                            ? "bg-info/10 text-info"
                            : "bg-surface-hover text-text-muted"
                        )}
                      >
                        {!a.is_enabled
                          ? t("status.disabled")
                          : a.is_overridden
                          ? t("status.overridden")
                          : t("status.default")}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-end">
                      <button
                        onClick={() => openEdit(a)}
                        className="rounded-lg border border-primary/30 px-3 py-1 text-xs text-primary hover:bg-primary/10"
                      >
                        {t("actions.edit")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-xl bg-surface p-6 shadow-xl">
              <h3 className="mb-4 text-lg font-semibold capitalize">
                {editing.agent_name}
              </h3>

              <label className="mb-1 block text-xs font-medium">
                {t("form.model")}
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {MODEL_CHOICES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                <option value="__custom__">{t("form.customModel")}…</option>
              </select>
              {model === "__custom__" && (
                <input
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="provider/model-id"
                  className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              )}

              <label className="mb-1 block text-xs font-medium">
                {t("form.systemPrompt")}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />

              <label className="mb-1 block text-xs font-medium">
                {t("form.temperature")}: {temperature.toFixed(2)}
              </label>
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="mb-3 w-full"
              />

              <label className="mb-1 block text-xs font-medium">
                {t("form.maxTokens")}
              </label>
              <input
                type="number"
                value={maxTokens}
                onChange={(e) =>
                  setMaxTokens(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />

              <label className="mb-4 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                {t("form.enabled")}
              </label>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditing(null)}
                  className="rounded-lg border border-border px-4 py-2 text-sm"
                >
                  {t("actions.cancel")}
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {saving ? "…" : t("actions.save")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
