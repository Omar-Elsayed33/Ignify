"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import EmptyState from "@/components/EmptyState";
import Modal from "@/components/Modal";
import { api } from "@/lib/api";
import {
  Plus,
  Eye,
  Globe,
  Clock,
  ExternalLink,
  Trash2,
  Loader2,
  AlertCircle,
  BarChart3,
  Instagram,
  Facebook,
  Twitter,
  Linkedin,
  Youtube,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Competitor {
  id: string;
  tenant_id: string;
  name: string;
  website: string | null;
  description: string | null;
  instagram?: string | null;
  facebook?: string | null;
  twitter?: string | null;
  linkedin?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  created_at: string;
}

interface AnalysisData {
  analysis?: string;
  status?: string;
  model?: string;
  [key: string]: unknown;
}

interface CompetitorSnapshot {
  id: string;
  competitor_id: string;
  data: AnalysisData | null;
  snapshot_type: string;
  status?: string;
  model_used?: string;
  created_at: string;
}

// ── Social Link Row ──────────────────────────────────────────────────────────

interface SocialLinkProps {
  url: string | null | undefined;
  icon: React.ElementType;
  label: string;
}

function SocialLink({ url, icon: Icon, label }: SocialLinkProps) {
  if (!url) return null;
  const href = url.startsWith("http") ? url : `https://${url}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted transition-colors hover:text-primary"
      title={label}
    >
      <Icon className="h-3.5 w-3.5" />
    </a>
  );
}

// ── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | undefined }) {
  if (!status) return null;
  const colors: Record<string, string> = {
    completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    failed: "bg-error/10 text-error",
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  };
  const cls = colors[status.toLowerCase()] ?? "bg-primary/10 text-primary";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function CompetitorsPage() {
  const t = useTranslations("competitorsPage");
  const tc = useTranslations("common");

  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add modal state
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addWebsite, setAddWebsite] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addInstagram, setAddInstagram] = useState("");
  const [addFacebook, setAddFacebook] = useState("");
  const [addTwitter, setAddTwitter] = useState("");
  const [addLinkedin, setAddLinkedin] = useState("");
  const [addTiktok, setAddTiktok] = useState("");
  const [addYoutube, setAddYoutube] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Per-card action states
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Latest snapshot per competitor
  const [snapshots, setSnapshots] = useState<Record<string, CompetitorSnapshot>>({});

  const fetchCompetitors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Competitor[]>("/api/v1/competitors/");
      setCompetitors(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchCompetitors();
  }, [fetchCompetitors]);

  function resetAddForm() {
    setAddName("");
    setAddWebsite("");
    setAddDescription("");
    setAddInstagram("");
    setAddFacebook("");
    setAddTwitter("");
    setAddLinkedin("");
    setAddTiktok("");
    setAddYoutube("");
    setAddError(null);
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!addName.trim()) return;
    setAddSubmitting(true);
    setAddError(null);
    try {
      const created = await api.post<Competitor>("/api/v1/competitors/", {
        name: addName.trim(),
        website: addWebsite.trim() || null,
        description: addDescription.trim() || null,
        instagram: addInstagram.trim() || null,
        facebook: addFacebook.trim() || null,
        twitter: addTwitter.trim() || null,
        linkedin: addLinkedin.trim() || null,
        tiktok: addTiktok.trim() || null,
        youtube: addYoutube.trim() || null,
      });
      setCompetitors((prev) => [created, ...prev]);
      setAddOpen(false);
      resetAddForm();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : t("errorAdd"));
    } finally {
      setAddSubmitting(false);
    }
  }

  async function handleAnalyze(id: string) {
    setAnalyzingId(id);
    setActionError(null);
    try {
      const snapshot = await api.post<CompetitorSnapshot>(
        `/api/v1/competitors/${id}/analyze`
      );
      setSnapshots((prev) => ({ ...prev, [id]: snapshot }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("errorAnalyze"));
    } finally {
      setAnalyzingId(null);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setActionError(null);
    try {
      await api.delete(`/api/v1/competitors/${id}`);
      setCompetitors((prev) => prev.filter((c) => c.id !== id));
      setSnapshots((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("errorDelete"));
    } finally {
      setDeletingId(null);
    }
  }

  // ── Input helper ─────────────────────────────────────────────────────────────
  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        <div className="mb-6 flex items-center justify-end">
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" />
            {t("addCompetitor")}
          </button>
        </div>

        {/* Global action error */}
        {actionError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {actionError}
            <button
              className="ms-auto text-xs underline"
              onClick={() => setActionError(null)}
            >
              {tc("close")}
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-56 animate-pulse rounded-xl border border-border bg-surface"
              />
            ))}
          </div>
        )}

        {/* Fetch error */}
        {!loading && error && (
          <div className="flex items-center gap-2 rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && competitors.length === 0 && (
          <EmptyState
            icon={Eye}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            actionLabel={t("addCompetitor")}
            onAction={() => setAddOpen(true)}
          />
        )}

        {/* Competitor cards */}
        {!loading && competitors.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {competitors.map((competitor) => {
              const snapshot = snapshots[competitor.id];
              const isAnalyzing = analyzingId === competitor.id;
              const isDeleting = deletingId === competitor.id;

              // Resolve status from multiple possible locations
              const snapshotStatus =
                snapshot?.data?.status ??
                snapshot?.status ??
                snapshot?.snapshot_type;

              const analysisText = snapshot?.data?.analysis;
              const modelUsed = snapshot?.data?.model ?? snapshot?.model_used;

              return (
                <div
                  key={competitor.id}
                  className="flex flex-col rounded-xl border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-semibold text-text-primary">
                        {competitor.name}
                      </h4>
                      {competitor.website && (
                        <a
                          href={
                            competitor.website.startsWith("http")
                              ? competitor.website
                              : `https://${competitor.website}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 flex items-center gap-1 text-xs text-text-muted hover:text-primary"
                        >
                          <Globe className="h-3 w-3 shrink-0" />
                          <span className="truncate">{competitor.website}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      )}
                    </div>
                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(competitor.id)}
                      disabled={isDeleting || isAnalyzing}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-error/20 text-error hover:bg-error/10 disabled:opacity-50"
                      aria-label={t("remove")}
                    >
                      {isDeleting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Description */}
                  {competitor.description && (
                    <p className="mt-2 line-clamp-2 text-xs text-text-secondary">
                      {competitor.description}
                    </p>
                  )}

                  {/* Social links */}
                  {(competitor.instagram ||
                    competitor.facebook ||
                    competitor.twitter ||
                    competitor.linkedin ||
                    competitor.tiktok ||
                    competitor.youtube) && (
                    <div className="mt-3 flex items-center gap-1">
                      <SocialLink url={competitor.instagram} icon={Instagram} label="Instagram" />
                      <SocialLink url={competitor.facebook} icon={Facebook} label="Facebook" />
                      <SocialLink url={competitor.twitter} icon={Twitter} label="Twitter / X" />
                      <SocialLink url={competitor.linkedin} icon={Linkedin} label="LinkedIn" />
                      <SocialLink url={competitor.youtube} icon={Youtube} label="YouTube" />
                    </div>
                  )}

                  {/* Date added */}
                  <div className="mt-3 flex items-center gap-1 text-xs text-text-muted">
                    <Clock className="h-3 w-3 shrink-0" />
                    {t("added")}: {new Date(competitor.created_at).toLocaleDateString()}
                  </div>

                  {/* Analyze button */}
                  <button
                    onClick={() => handleAnalyze(competitor.id)}
                    disabled={isAnalyzing || isDeleting}
                    className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary/10 py-2 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                  >
                    {isAnalyzing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <BarChart3 className="h-3.5 w-3.5" />
                    )}
                    {isAnalyzing ? t("analyzing") : t("analyze")}
                  </button>

                  {/* Analysis result */}
                  {snapshot && (
                    <div className="mt-4 rounded-lg border border-border bg-background p-3">
                      {/* Status + model row */}
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-text-muted">
                            {t("lastAnalysis")}:
                          </span>
                          <StatusBadge status={String(snapshotStatus ?? "")} />
                        </div>
                        {modelUsed && (
                          <span className="truncate text-xs text-text-muted" title={String(modelUsed)}>
                            {String(modelUsed)}
                          </span>
                        )}
                      </div>

                      {/* Full analysis text */}
                      {analysisText ? (
                        <div className="max-h-48 overflow-y-auto">
                          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-text-secondary">
                            {String(analysisText)}
                          </pre>
                        </div>
                      ) : (
                        <p className="text-xs text-text-muted">
                          {String(snapshotStatus ?? snapshot.snapshot_type)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add Competitor Modal ─────────────────────────────────────────────── */}
      <Modal
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) resetAddForm();
        }}
        title={t("addCompetitor")}
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          {addError && (
            <div className="flex items-center gap-2 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {addError}
            </div>
          )}

          {/* Core fields */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("competitorName")} <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("website")}
            </label>
            <input
              type="url"
              value={addWebsite}
              onChange={(e) => setAddWebsite(e.target.value)}
              placeholder="https://"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {tc("description")}
            </label>
            <textarea
              value={addDescription}
              onChange={(e) => setAddDescription(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>

          {/* Social links */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
              {t("socialLinks")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  { state: addInstagram, setter: setAddInstagram, label: "Instagram", ph: "https://instagram.com/handle" },
                  { state: addFacebook, setter: setAddFacebook, label: "Facebook", ph: "https://facebook.com/page" },
                  { state: addTwitter, setter: setAddTwitter, label: "Twitter / X", ph: "https://x.com/handle" },
                  { state: addLinkedin, setter: setAddLinkedin, label: "LinkedIn", ph: "https://linkedin.com/company" },
                  { state: addTiktok, setter: setAddTiktok, label: "TikTok", ph: "https://tiktok.com/@handle" },
                  { state: addYoutube, setter: setAddYoutube, label: "YouTube", ph: "https://youtube.com/@channel" },
                ] as {
                  state: string;
                  setter: (v: string) => void;
                  label: string;
                  ph: string;
                }[]
              ).map(({ state, setter, label, ph }) => (
                <div key={label}>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    {label}
                  </label>
                  <input
                    type="url"
                    value={state}
                    onChange={(e) => setter(e.target.value)}
                    placeholder={ph}
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setAddOpen(false);
                resetAddForm();
              }}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
            >
              {tc("cancel")}
            </button>
            <button
              type="submit"
              disabled={addSubmitting}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {addSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("addCompetitor")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
