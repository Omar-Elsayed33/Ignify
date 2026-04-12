"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import { api } from "@/lib/api";
import {
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  Check,
  AlertCircle,
  FileDown,
} from "lucide-react";
import { clsx } from "clsx";

type Target = "post" | "blog" | "caption" | "ad_copy";
type Language = "ar" | "en" | "both";

interface Row {
  id: string;
  brief: string;
  target: Target;
  channel: string;
  language: Language;
  status: "pending" | "running" | "ok" | "error";
  result?: { content_item_id?: string; title?: string; error?: string };
}

interface PlanListItem {
  id: string;
  title: string;
  status: string;
  calendar?: Array<{ topic?: string; channel?: string }>;
}

const CHANNELS = ["instagram", "facebook", "twitter", "linkedin", "tiktok", "blog", "email"];

function newRow(): Row {
  return {
    id: Math.random().toString(36).slice(2),
    brief: "",
    target: "post",
    channel: "instagram",
    language: "en",
    status: "pending",
  };
}

export default function BulkContentPage() {
  const t = useTranslations("contentBulk");
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanListItem[]>([]);
  const [showPlanPicker, setShowPlanPicker] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<PlanListItem[]>("/api/v1/plans/");
        setPlans(data.filter((p) => p.status === "approved"));
      } catch {
        // noop
      }
    })();
  }, []);

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  async function loadFromPlan(planId: string) {
    setShowPlanPicker(false);
    try {
      const plan = await api.get<PlanListItem & { calendar?: unknown }>(
        `/api/v1/plans/${planId}`
      );
      const cal = Array.isArray(plan.calendar) ? plan.calendar : [];
      const newRows: Row[] = cal
        .filter((e: { topic?: string }) => e?.topic)
        .map((e: { topic?: string; channel?: string }) => ({
          id: Math.random().toString(36).slice(2),
          brief: e.topic || "",
          target: "post",
          channel: (e.channel || "instagram").toLowerCase(),
          language: "ar",
          status: "pending",
        }));
      if (newRows.length) setRows(newRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load plan");
    }
  }

  async function generateAll() {
    if (!rows.length) return;
    setGenerating(true);
    setError(null);
    // Mark all running visually; server runs concurrently
    setRows((rs) => rs.map((r) => ({ ...r, status: "running", result: undefined })));
    try {
      const res = await api.post<{
        results: Array<{
          index: number;
          status: string;
          content_item_id?: string;
          title?: string;
          error?: string;
        }>;
      }>("/api/v1/content-gen/bulk-generate", {
        items: rows.map((r) => ({
          brief: r.brief,
          target: r.target,
          channel: r.channel,
          language: r.language,
        })),
        concurrency: 3,
      });
      setRows((rs) =>
        rs.map((r, i) => {
          const m = res.results.find((x) => x.index === i);
          if (!m) return { ...r, status: "error", result: { error: "no response" } };
          return {
            ...r,
            status: m.status === "ok" ? "ok" : "error",
            result: {
              content_item_id: m.content_item_id,
              title: m.title,
              error: m.error,
            },
          };
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk generation failed");
      setRows((rs) => rs.map((r) => (r.status === "running" ? { ...r, status: "error" } : r)));
    } finally {
      setGenerating(false);
    }
  }

  const statusPill = (status: Row["status"]) => {
    const color: Record<Row["status"], string> = {
      pending: "bg-text-muted/10 text-text-muted",
      running: "bg-primary/10 text-primary",
      ok: "bg-success/10 text-success",
      error: "bg-error/10 text-error",
    };
    const Icon =
      status === "running"
        ? Loader2
        : status === "ok"
          ? Check
          : status === "error"
            ? AlertCircle
            : null;
    return (
      <span
        className={clsx(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
          color[status]
        )}
      >
        {Icon && <Icon className={clsx("h-3 w-3", status === "running" && "animate-spin")} />}
        {t(`status.${status}`)}
      </span>
    );
  };

  return (
    <div>
      <DashboardHeader title={t("title")} />
      <div className="p-6">
        <p className="mb-4 text-sm text-text-secondary">{t("subtitle")}</p>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-4 py-2 text-sm text-error">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, newRow()])}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface-hover"
          >
            <Plus className="h-4 w-4" />
            {t("addRow")}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPlanPicker((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface-hover"
            >
              <FileDown className="h-4 w-4" />
              {t("loadFromPlan")}
            </button>
            {showPlanPicker && (
              <div className="absolute z-10 mt-1 max-h-60 w-64 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
                {plans.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-text-muted">{t("pickPlan")}</div>
                ) : (
                  plans.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => loadFromPlan(p.id)}
                      className="block w-full px-3 py-2 text-start text-sm hover:bg-surface-hover"
                    >
                      {p.title}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="flex-1" />
          <button
            type="button"
            onClick={generateAll}
            disabled={generating || rows.length === 0}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generating ? t("generating") : t("generateAll")}
          </button>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-sm text-text-muted">
            {t("empty")}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-background text-xs uppercase text-text-muted">
                <tr>
                  <th className="px-3 py-2 text-start font-medium">#</th>
                  <th className="px-3 py-2 text-start font-medium">{t("columns.brief")}</th>
                  <th className="px-3 py-2 text-start font-medium">{t("columns.target")}</th>
                  <th className="px-3 py-2 text-start font-medium">{t("columns.channel")}</th>
                  <th className="px-3 py-2 text-start font-medium">{t("columns.language")}</th>
                  <th className="px-3 py-2 text-start font-medium">{t("columns.status")}</th>
                  <th className="px-3 py-2 text-start font-medium">{t("columns.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row, i) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 text-text-muted">{i + 1}</td>
                    <td className="px-3 py-2">
                      <textarea
                        rows={2}
                        value={row.brief}
                        onChange={(e) => updateRow(row.id, { brief: e.target.value })}
                        className="w-full min-w-[240px] resize-y rounded-md border border-border bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.target}
                        onChange={(e) =>
                          updateRow(row.id, { target: e.target.value as Target })
                        }
                        className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                      >
                        <option value="post">post</option>
                        <option value="caption">caption</option>
                        <option value="blog">blog</option>
                        <option value="ad_copy">ad_copy</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.channel}
                        onChange={(e) => updateRow(row.id, { channel: e.target.value })}
                        className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                      >
                        {CHANNELS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.language}
                        onChange={(e) =>
                          updateRow(row.id, { language: e.target.value as Language })
                        }
                        className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                      >
                        <option value="ar">ar</option>
                        <option value="en">en</option>
                        <option value="both">both</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">{statusPill(row.status)}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="rounded-md p-1.5 text-text-muted hover:bg-error/10 hover:text-error"
                        title={t("removeRow")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
