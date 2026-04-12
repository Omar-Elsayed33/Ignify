"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import DataTable, { Column } from "@/components/DataTable";
import { api } from "@/lib/api";
import {
  Search,
  TrendingUp,
  TrendingDown,
  FileSearch,
  Play,
  Plus,
  Loader2,
  X,
} from "lucide-react";
import { clsx } from "clsx";

// ── Types matching backend snake_case responses ──

interface SEOKeyword {
  id: string;
  tenant_id: string;
  keyword: string;
  search_volume: number | null;
  difficulty: number | null;
  current_rank: number | null;
  target_url: string | null;
  created_at: string;
  [key: string]: unknown;
}

interface SEOAudit {
  id: string;
  tenant_id: string;
  audit_type: string;
  score: number | null;
  issues: unknown[] | null;
  recommendations: unknown[] | null;
  created_at: string;
}

function difficultyLabel(d: number | null): { label: string; cls: string } {
  if (d == null) return { label: "Unknown", cls: "bg-text-muted/10 text-text-muted" };
  if (d <= 30) return { label: "Easy", cls: "bg-success/10 text-success" };
  if (d <= 60) return { label: "Medium", cls: "bg-accent/10 text-accent" };
  return { label: "Hard", cls: "bg-error/10 text-error" };
}

export default function SeoPage() {
  const t = useTranslations("seoPage");

  // ── State ──
  const [keywords, setKeywords] = useState<SEOKeyword[]>([]);
  const [audits, setAudits] = useState<SEOAudit[]>([]);
  const [loadingKeywords, setLoadingKeywords] = useState(true);
  const [loadingAudits, setLoadingAudits] = useState(true);
  const [showAddKeyword, setShowAddKeyword] = useState(false);
  const [addingKeyword, setAddingKeyword] = useState(false);
  const [keywordError, setKeywordError] = useState<string | null>(null);
  const [runningAudit, setRunningAudit] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const [kwForm, setKwForm] = useState({
    keyword: "",
    search_volume: "",
    difficulty: "",
    current_rank: "",
    target_url: "",
  });

  // ── Fetch keywords ──
  useEffect(() => {
    setLoadingKeywords(true);
    api
      .get<SEOKeyword[]>("/api/v1/seo/keywords")
      .then(setKeywords)
      .catch(() => setKeywords([]))
      .finally(() => setLoadingKeywords(false));
  }, []);

  // ── Fetch audits ──
  useEffect(() => {
    setLoadingAudits(true);
    api
      .get<SEOAudit[]>("/api/v1/seo/audits")
      .then(setAudits)
      .catch(() => setAudits([]))
      .finally(() => setLoadingAudits(false));
  }, []);

  // ── Add keyword ──
  async function handleAddKeyword(e: React.FormEvent) {
    e.preventDefault();
    if (!kwForm.keyword.trim()) {
      setKeywordError("Keyword is required.");
      return;
    }
    setAddingKeyword(true);
    setKeywordError(null);
    try {
      const payload = {
        keyword: kwForm.keyword.trim(),
        search_volume: kwForm.search_volume ? parseInt(kwForm.search_volume) : null,
        difficulty: kwForm.difficulty ? parseInt(kwForm.difficulty) : null,
        current_rank: kwForm.current_rank ? parseInt(kwForm.current_rank) : null,
        target_url: kwForm.target_url || null,
      };
      const created = await api.post<SEOKeyword>("/api/v1/seo/keywords", payload);
      setKeywords((prev) => [created, ...prev]);
      setShowAddKeyword(false);
      setKwForm({ keyword: "", search_volume: "", difficulty: "", current_rank: "", target_url: "" });
    } catch (err: unknown) {
      setKeywordError(err instanceof Error ? err.message : "Failed to add keyword");
    } finally {
      setAddingKeyword(false);
    }
  }

  // ── Run audit ──
  async function handleRunAudit() {
    setRunningAudit(true);
    setAuditError(null);
    try {
      const created = await api.post<SEOAudit>("/api/v1/seo/audits", {
        audit_type: "full",
      });
      setAudits((prev) => [created, ...prev]);
    } catch (err: unknown) {
      setAuditError(err instanceof Error ? err.message : "Failed to run audit");
    } finally {
      setRunningAudit(false);
    }
  }

  // ── Derived stats from real data ──
  const latestAudit = audits[0] ?? null;
  const avgRank =
    keywords.length > 0
      ? Math.round(
          keywords.reduce((sum, k) => sum + (k.current_rank ?? 0), 0) / keywords.length
        )
      : null;

  // ── Analyze keyword with AI ──
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  async function handleAnalyzeKeyword(id: string) {
    setAnalyzingId(id);
    try {
      const updated = await api.post<SEOKeyword>(`/api/v1/seo/keywords/${id}/analyze`);
      setKeywords((prev) => prev.map((k) => (k.id === id ? updated : k)));
    } catch {
      // silently fail
    } finally {
      setAnalyzingId(null);
    }
  }

  // ── Expand audit details ──
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  // ── Table columns ──
  const columns: Column<SEOKeyword>[] = [
    { key: "keyword", label: t("keyword"), sortable: true },
    {
      key: "search_volume",
      label: t("volume"),
      sortable: true,
      render: (item) =>
        item.search_volume != null
          ? Number(item.search_volume).toLocaleString()
          : "—",
    },
    {
      key: "difficulty",
      label: t("difficulty"),
      render: (item) => {
        const { label, cls } = difficultyLabel(item.difficulty as number | null);
        return (
          <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", cls)}>
            {label} {item.difficulty != null ? `(${item.difficulty})` : ""}
          </span>
        );
      },
    },
    {
      key: "current_rank",
      label: t("rank"),
      sortable: true,
      render: (item) =>
        item.current_rank != null ? (
          <span className="font-semibold text-text-primary">#{item.current_rank}</span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      key: "actions" as keyof SEOKeyword,
      label: "",
      render: (item) => (
        <button
          onClick={() => handleAnalyzeKeyword(item.id)}
          disabled={analyzingId === item.id}
          className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
          title="AI Analyze"
        >
          {analyzingId === item.id ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5" />
          )}
          Analyze
        </button>
      ),
    },
  ];

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        {/* Stats Cards */}
        <div className="mb-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {/* Latest audit score */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Search className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-text-muted">{t("seoScore")}</p>
                <p className="text-2xl font-bold text-text-primary">
                  {loadingAudits ? "…" : latestAudit?.score != null ? `${latestAudit.score}/100` : "—"}
                </p>
              </div>
            </div>
          </div>
          {/* Keywords tracked */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-success/10 p-2">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-text-muted">{t("keywordTracking")}</p>
                <p className="text-2xl font-bold text-text-primary">
                  {loadingKeywords ? "…" : keywords.length}
                </p>
              </div>
            </div>
          </div>
          {/* Avg rank */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent/10 p-2">
                <TrendingDown className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-xs text-text-muted">Avg. Rank</p>
                <p className="text-2xl font-bold text-text-primary">
                  {loadingKeywords ? "…" : avgRank != null ? `#${avgRank}` : "—"}
                </p>
              </div>
            </div>
          </div>
          {/* Total audits */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-info/10 p-2">
                <FileSearch className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-xs text-text-muted">{t("recentAudits")}</p>
                <p className="text-2xl font-bold text-text-primary">
                  {loadingAudits ? "…" : audits.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          {/* Keyword Tracking Table */}
          <div className="xl:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">{t("keywordTracking")}</h3>
              <button
                onClick={() => setShowAddKeyword(true)}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
              >
                <Plus className="h-4 w-4" />
                Add Keyword
              </button>
            </div>

            {loadingKeywords ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : keywords.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-16 text-center">
                <Search className="mx-auto mb-3 h-10 w-10 text-text-muted/40" />
                <p className="text-sm text-text-muted">No keywords tracked yet.</p>
                <button
                  onClick={() => setShowAddKeyword(true)}
                  className="mt-4 text-sm font-medium text-primary hover:underline"
                >
                  Add your first keyword
                </button>
              </div>
            ) : (
              <DataTable
                columns={columns}
                data={keywords as unknown as Record<string, unknown>[]}
              />
            )}
          </div>

          {/* Audits Panel */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">{t("recentAudits")}</h3>
              <button
                onClick={handleRunAudit}
                disabled={runningAudit}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {runningAudit ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {t("runAudit")}
              </button>
            </div>

            {auditError && (
              <div className="mb-3 rounded-lg bg-error/10 px-4 py-2.5 text-sm text-error">
                {auditError}
              </div>
            )}

            {loadingAudits ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : audits.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-12 text-center">
                <FileSearch className="mx-auto mb-3 h-10 w-10 text-text-muted/40" />
                <p className="text-sm text-text-muted">No audits run yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {audits.map((audit) => {
                  const issueCount = Array.isArray(audit.issues) ? audit.issues.length : 0;
                  const recCount = Array.isArray(audit.recommendations) ? audit.recommendations.length : 0;
                  const scoreColor =
                    audit.score != null && audit.score >= 85
                      ? "bg-success/10 text-success"
                      : audit.score != null && audit.score >= 70
                      ? "bg-accent/10 text-accent"
                      : "bg-error/10 text-error";
                  const isExpanded = expandedAuditId === audit.id;
                  return (
                    <div key={audit.id} className="rounded-xl border border-border bg-surface shadow-sm">
                      <button
                        onClick={() => setExpandedAuditId(isExpanded ? null : audit.id)}
                        className="flex w-full items-center justify-between p-4 text-start"
                      >
                        <div>
                          <p className="text-sm font-medium capitalize text-text-primary">
                            {audit.audit_type} Audit
                          </p>
                          <p className="mt-0.5 text-xs text-text-muted">
                            {new Date(audit.created_at).toLocaleDateString()} · {issueCount} issues · {recCount} recommendations
                          </p>
                        </div>
                        <div
                          className={clsx(
                            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                            scoreColor
                          )}
                        >
                          {audit.score ?? "—"}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-border px-4 pb-4 pt-3">
                          {/* Issues */}
                          {issueCount > 0 && (
                            <div className="mb-4">
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-error">Issues ({issueCount})</p>
                              <div className="space-y-2">
                                {(audit.issues as Array<Record<string, string>>).map((issue, i) => (
                                  <div key={i} className="rounded-lg bg-error/5 p-3">
                                    <div className="flex items-center gap-2">
                                      <span className={clsx(
                                        "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                                        issue.severity === "high" ? "bg-error/20 text-error" :
                                        issue.severity === "medium" ? "bg-accent/20 text-accent" :
                                        "bg-info/20 text-info"
                                      )}>
                                        {issue.severity}
                                      </span>
                                      <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-text-muted">{issue.category}</span>
                                    </div>
                                    <p className="mt-1 text-sm font-medium text-text-primary">{issue.title}</p>
                                    <p className="mt-0.5 text-xs text-text-secondary">{issue.description}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Recommendations */}
                          {recCount > 0 && (
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-success">Recommendations ({recCount})</p>
                              <div className="space-y-2">
                                {(audit.recommendations as Array<Record<string, string>>).map((rec, i) => (
                                  <div key={i} className="rounded-lg bg-success/5 p-3">
                                    <div className="flex items-center gap-2">
                                      <span className={clsx(
                                        "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                                        rec.priority === "high" ? "bg-error/20 text-error" :
                                        rec.priority === "medium" ? "bg-accent/20 text-accent" :
                                        "bg-success/20 text-success"
                                      )}>
                                        {rec.priority}
                                      </span>
                                      <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-text-muted">{rec.category}</span>
                                    </div>
                                    <p className="mt-1 text-sm font-medium text-text-primary">{rec.title}</p>
                                    <p className="mt-0.5 text-xs text-text-secondary">{rec.description}</p>
                                    {rec.impact && <p className="mt-1 text-xs font-medium text-success">Impact: {rec.impact}</p>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Keyword Modal */}
      {showAddKeyword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">Add Keyword</h2>
              <button
                onClick={() => { setShowAddKeyword(false); setKeywordError(null); }}
                className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {keywordError && (
              <div className="mb-4 rounded-lg bg-error/10 px-4 py-2.5 text-sm text-error">
                {keywordError}
              </div>
            )}

            <form onSubmit={handleAddKeyword} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">{t("keyword")} *</label>
                <input
                  required
                  type="text"
                  value={kwForm.keyword}
                  onChange={(e) => setKwForm((f) => ({ ...f, keyword: e.target.value }))}
                  placeholder="e.g. AI marketing platform"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">{t("volume")}</label>
                  <input
                    type="number"
                    min="0"
                    value={kwForm.search_volume}
                    onChange={(e) => setKwForm((f) => ({ ...f, search_volume: e.target.value }))}
                    placeholder="e.g. 8100"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">{t("difficulty")} (0–100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={kwForm.difficulty}
                    onChange={(e) => setKwForm((f) => ({ ...f, difficulty: e.target.value }))}
                    placeholder="e.g. 45"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Current {t("rank")}</label>
                <input
                  type="number"
                  min="1"
                  value={kwForm.current_rank}
                  onChange={(e) => setKwForm((f) => ({ ...f, current_rank: e.target.value }))}
                  placeholder="e.g. 5"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Target URL</label>
                <input
                  type="url"
                  value={kwForm.target_url}
                  onChange={(e) => setKwForm((f) => ({ ...f, target_url: e.target.value }))}
                  placeholder="https://example.com/page"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddKeyword(false); setKeywordError(null); }}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingKeyword}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
                >
                  {addingKeyword && <Loader2 className="h-4 w-4 animate-spin" />}
                  Add Keyword
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
