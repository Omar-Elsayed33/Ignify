"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useLocale } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import Modal from "@/components/Modal";
import { api } from "@/lib/api";
import {
  AlertCircle,
  Loader2,
  Plus,
  Users,
  X,
  Sparkles,
  Phone,
  Mail,
} from "lucide-react";
import { clsx } from "clsx";

type Stage = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";
type Source =
  | "whatsapp"
  | "messenger"
  | "instagram"
  | "website"
  | "ads"
  | "manual"
  | "facebook"
  | "other";

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: Source;
  score: number | null;
  status: Stage;
  activities_count?: number;
  created_at: string;
  updated_at: string;
}

interface KanbanColumn {
  stage: Stage;
  leads: Lead[];
}

interface Activity {
  id: string;
  lead_id: string;
  activity_type: string;
  description: string | null;
  created_at: string;
}

const STAGES: Stage[] = ["new", "contacted", "qualified", "proposal", "won", "lost"];

const stageStyles: Record<Stage, { bar: string; badge: string; dot: string }> = {
  new: { bar: "bg-info", badge: "bg-info/10 text-info", dot: "bg-info" },
  contacted: { bar: "bg-accent", badge: "bg-accent/10 text-accent", dot: "bg-accent" },
  qualified: { bar: "bg-primary", badge: "bg-primary/10 text-primary", dot: "bg-primary" },
  proposal: { bar: "bg-purple-500", badge: "bg-purple-500/10 text-purple-500", dot: "bg-purple-500" },
  won: { bar: "bg-success", badge: "bg-success/10 text-success", dot: "bg-success" },
  lost: { bar: "bg-error", badge: "bg-error/10 text-error", dot: "bg-error" },
};

const sourceStyles: Record<string, string> = {
  whatsapp: "bg-emerald-500/10 text-emerald-600",
  messenger: "bg-blue-500/10 text-blue-600",
  instagram: "bg-pink-500/10 text-pink-600",
  facebook: "bg-blue-600/10 text-blue-700",
  website: "bg-slate-500/10 text-slate-600",
  ads: "bg-orange-500/10 text-orange-600",
  manual: "bg-gray-500/10 text-gray-600",
  other: "bg-gray-400/10 text-gray-500",
};

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) return null;
  const tone =
    score >= 80
      ? "bg-success/10 text-success"
      : score >= 50
        ? "bg-accent/10 text-accent"
        : "bg-error/10 text-error";
  return (
    <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-semibold", tone)}>
      {score}
    </span>
  );
}

export default function LeadsKanbanPage() {
  const t = useTranslations("leads");
  const tPage = useTranslations("leadsPage");
  const locale = useLocale();

  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    source: "manual" as Source,
    notes: "",
  });

  const [drawerLead, setDrawerLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [qualifying, setQualifying] = useState(false);

  const [dragLeadId, setDragLeadId] = useState<string | null>(null);

  const fetchKanban = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<KanbanColumn[]>("/api/v1/leads/kanban");
      // Ensure all stages present
      const map = new Map<Stage, Lead[]>();
      data.forEach((c) => map.set(c.stage as Stage, c.leads));
      setColumns(STAGES.map((s) => ({ stage: s, leads: map.get(s) ?? [] })));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.failed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchKanban();
  }, [fetchKanban]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      setSubmitting(true);
      setFormError(null);
      await api.post<Lead>("/api/v1/leads/", {
        name: form.name,
        phone: form.phone || undefined,
        email: form.email || undefined,
        source: form.source,
        notes: form.notes || undefined,
      });
      setAddOpen(false);
      setForm({ name: "", phone: "", email: "", source: "manual", notes: "" });
      fetchKanban();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("errors.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function moveLead(leadId: string, toStage: Stage) {
    // Optimistic update
    setColumns((prev) => {
      const next = prev.map((c) => ({ ...c, leads: [...c.leads] }));
      let moved: Lead | null = null;
      for (const c of next) {
        const idx = c.leads.findIndex((l) => l.id === leadId);
        if (idx >= 0) {
          moved = { ...c.leads[idx], status: toStage };
          c.leads.splice(idx, 1);
          break;
        }
      }
      if (moved) {
        const col = next.find((c) => c.stage === toStage);
        if (col) col.leads.unshift(moved);
      }
      return next;
    });
    try {
      await api.post(`/api/v1/leads/${leadId}/move`, { stage: toStage });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.failed"));
      fetchKanban();
    }
  }

  async function openDrawer(lead: Lead) {
    setDrawerLead(lead);
    setActivities([]);
    setLoadingActivities(true);
    try {
      const data = await api.get<Activity[]>(`/api/v1/leads/${lead.id}/activities`);
      setActivities(data);
    } catch {
      setActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  }

  async function addNote() {
    if (!drawerLead || !noteText.trim()) return;
    try {
      const a = await api.post<Activity>(
        `/api/v1/leads/${drawerLead.id}/activities`,
        { activity_type: "note", content: noteText }
      );
      setActivities((prev) => [a, ...prev]);
      setNoteText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.failed"));
    }
  }

  async function qualifyLead() {
    if (!drawerLead) return;
    try {
      setQualifying(true);
      const r = await api.post<{ score: number; qualification: string; next_action: string }>(
        `/api/v1/leads/${drawerLead.id}/qualify`
      );
      setDrawerLead({ ...drawerLead, score: r.score });
      // refresh activities & kanban
      const data = await api.get<Activity[]>(`/api/v1/leads/${drawerLead.id}/activities`);
      setActivities(data);
      fetchKanban();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.failed"));
    } finally {
      setQualifying(false);
    }
  }

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        {error && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="mb-5 flex items-center justify-between">
          <p className="text-sm text-text-muted">{t("subtitle")}</p>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" />
            {t("form.new")}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex gap-4 pb-4" style={{ minWidth: "max-content" }}>
              {columns.map((col) => {
                const style = stageStyles[col.stage];
                return (
                  <div
                    key={col.stage}
                    className="flex w-[280px] shrink-0 flex-col rounded-xl bg-background/50 p-2"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/lead-id") || dragLeadId;
                      if (id) moveLead(id, col.stage);
                      setDragLeadId(null);
                    }}
                  >
                    <div className="mb-3 flex items-center justify-between px-2">
                      <div className="flex items-center gap-2">
                        <span className={clsx("h-2.5 w-2.5 rounded-full", style.dot)} />
                        <p className="text-sm font-semibold text-text-primary">
                          {t(`kanban.${col.stage}`)}
                        </p>
                      </div>
                      <span className={clsx("rounded-full px-2 py-0.5 text-xs font-semibold", style.badge)}>
                        {col.leads.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 min-h-[100px]">
                      {col.leads.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border/60 px-3 py-8 text-center text-xs text-text-muted">
                          —
                        </div>
                      ) : (
                        col.leads.map((lead) => (
                          <div
                            key={lead.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/lead-id", lead.id);
                              e.dataTransfer.effectAllowed = "move";
                              setDragLeadId(lead.id);
                            }}
                            onDragEnd={() => setDragLeadId(null)}
                            onClick={() => openDrawer(lead)}
                            className={clsx(
                              "group cursor-grab rounded-lg border border-border bg-surface p-3 shadow-sm transition-all hover:shadow-md active:cursor-grabbing",
                              dragLeadId === lead.id && "opacity-50"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium text-text-primary line-clamp-1">
                                {lead.name}
                              </p>
                              <ScoreBadge score={lead.score} />
                            </div>
                            <div className="mt-1.5 space-y-0.5">
                              {lead.phone && (
                                <div className="flex items-center gap-1 text-xs text-text-muted">
                                  <Phone className="h-3 w-3" />
                                  <span className="truncate">{lead.phone}</span>
                                </div>
                              )}
                              {lead.email && (
                                <div className="flex items-center gap-1 text-xs text-text-muted">
                                  <Mail className="h-3 w-3" />
                                  <span className="truncate">{lead.email}</span>
                                </div>
                              )}
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <span
                                className={clsx(
                                  "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                                  sourceStyles[lead.source] ?? sourceStyles.other
                                )}
                              >
                                {t.has(`source.${lead.source}`) ? t(`source.${lead.source}`) : lead.source}
                              </span>
                              <Link
                                href={`/${locale}/leads/${lead.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-[11px] text-primary opacity-0 transition-opacity group-hover:opacity-100 hover:underline"
                              >
                                {t("card.viewDetails")}
                              </Link>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal open={addOpen} onOpenChange={setAddOpen} title={t("form.new")}>
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {formError}
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("form.name")}
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">
                {t("form.phone")}
              </label>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">
                {t("form.email")}
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("form.source")}
            </label>
            <select
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as Source }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="manual">{t("source.manual")}</option>
              <option value="whatsapp">{t("source.whatsapp")}</option>
              <option value="instagram">{t("source.instagram")}</option>
              <option value="messenger">{t("source.facebook")}</option>
              <option value="website">{t("source.website")}</option>
              <option value="ads">Ads</option>
              <option value="other">{t("source.other")}</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("form.notes")}
            </label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
            >
              {tPage("cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("form.submit")}
            </button>
          </div>
        </form>
      </Modal>

      {/* Side Drawer */}
      {drawerLead && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/30 backdrop-blur-sm"
            onClick={() => setDrawerLead(null)}
          />
          <div className="w-full max-w-md overflow-y-auto bg-surface shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-surface px-5 py-4">
              <div>
                <p className="text-base font-semibold text-text-primary">{drawerLead.name}</p>
                <p className="text-xs text-text-muted capitalize">
                  {t(`kanban.${drawerLead.status}`)}
                </p>
              </div>
              <button
                onClick={() => setDrawerLead(null)}
                className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="space-y-2 rounded-xl border border-border p-4">
                {drawerLead.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-text-muted" />
                    <span>{drawerLead.phone}</span>
                  </div>
                )}
                {drawerLead.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-text-muted" />
                    <span>{drawerLead.email}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span
                    className={clsx(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                      sourceStyles[drawerLead.source] ?? sourceStyles.other
                    )}
                  >
                    {t.has(`source.${drawerLead.source}`) ? t(`source.${drawerLead.source}`) : drawerLead.source}
                  </span>
                  {drawerLead.score !== null && <ScoreBadge score={drawerLead.score} />}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={qualifyLead}
                  disabled={qualifying}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
                >
                  {qualifying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {qualifying ? t("actions.qualifying") : t("actions.qualify")}
                </button>
                <select
                  value={drawerLead.status}
                  onChange={(e) => {
                    const s = e.target.value as Stage;
                    moveLead(drawerLead.id, s);
                    setDrawerLead({ ...drawerLead, status: s });
                  }}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {t(`kanban.${s}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-text-primary">
                  {t("activities.title")}
                </p>
                <div className="mb-3 space-y-2">
                  <textarea
                    rows={2}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder={t("activities.addNote")}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                  <button
                    onClick={addNote}
                    disabled={!noteText.trim()}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-60"
                  >
                    {t("activities.addNote")}
                  </button>
                </div>

                {loadingActivities ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : activities.length === 0 ? (
                  <p className="py-4 text-center text-xs text-text-muted">
                    {t("activities.empty")}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {activities.map((a) => (
                      <li
                        key={a.id}
                        className="rounded-lg border border-border bg-background/40 p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                            {t.has(`activity.${a.activity_type}`) ? t(`activity.${a.activity_type}`) : a.activity_type}
                          </span>
                          <span className="text-[10px] text-text-muted">
                            {new Date(a.created_at).toLocaleString(locale === "ar" ? "ar" : "en")}
                          </span>
                        </div>
                        {a.description && (
                          <p className="mt-1 whitespace-pre-wrap text-xs text-text-secondary">
                            {a.description}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
