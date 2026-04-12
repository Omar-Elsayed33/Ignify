"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import { api } from "@/lib/api";
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  Mail,
  Phone,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { clsx } from "clsx";

type Stage = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string;
  score: number | null;
  status: Stage;
  created_at: string;
  updated_at: string;
}

interface Activity {
  id: string;
  lead_id: string;
  activity_type: string;
  description: string | null;
  created_at: string;
}

const STAGES: Stage[] = ["new", "contacted", "qualified", "proposal", "won", "lost"];

export default function LeadDetailPage() {
  const t = useTranslations("leads");
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Lead>>({});
  const [saving, setSaving] = useState(false);

  const [noteText, setNoteText] = useState("");
  const [qualifying, setQualifying] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [l, acts] = await Promise.all([
        api.get<Lead>(`/api/v1/leads/${id}`),
        api.get<Activity[]>(`/api/v1/leads/${id}/activities`),
      ]);
      setLead(l);
      setForm(l);
      setActivities(acts);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.failed"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!lead) return;
    try {
      setSaving(true);
      const updated = await api.patch<Lead>(`/api/v1/leads/${lead.id}`, {
        name: form.name,
        phone: form.phone,
        email: form.email,
        company: form.company,
      });
      setLead(updated);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.failed"));
    } finally {
      setSaving(false);
    }
  }

  async function changeStage(stage: Stage) {
    if (!lead) return;
    try {
      const updated = await api.post<Lead>(`/api/v1/leads/${lead.id}/move`, {
        stage,
      });
      setLead(updated);
      // reload activities to show stage_change entry
      const acts = await api.get<Activity[]>(`/api/v1/leads/${lead.id}/activities`);
      setActivities(acts);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.failed"));
    }
  }

  async function addNote() {
    if (!lead || !noteText.trim()) return;
    try {
      const a = await api.post<Activity>(`/api/v1/leads/${lead.id}/activities`, {
        activity_type: "note",
        content: noteText,
      });
      setActivities((prev) => [a, ...prev]);
      setNoteText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.failed"));
    }
  }

  async function qualify() {
    if (!lead) return;
    try {
      setQualifying(true);
      const r = await api.post<{ score: number; qualification: string; next_action: string }>(
        `/api/v1/leads/${lead.id}/qualify`
      );
      setLead({ ...lead, score: r.score });
      const acts = await api.get<Activity[]>(`/api/v1/leads/${lead.id}/activities`);
      setActivities(acts);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.failed"));
    } finally {
      setQualifying(false);
    }
  }

  async function remove() {
    if (!lead) return;
    if (!confirm(t("actions.delete"))) return;
    try {
      await api.delete(`/api/v1/leads/${lead.id}`);
      router.push(`/${locale}/leads`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.failed"));
    }
  }

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        <button
          onClick={() => router.push(`/${locale}/leads`)}
          className="mb-4 flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("title")}
        </button>

        {error && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {loading || !lead ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Lead info */}
            <div className="lg:col-span-1">
              <div className="rounded-xl border border-border bg-surface p-5">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    {editing ? (
                      <input
                        value={form.name ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        className="rounded-lg border border-border bg-background px-2 py-1 text-lg font-semibold focus:border-primary focus:outline-none"
                      />
                    ) : (
                      <h2 className="text-lg font-semibold text-text-primary">{lead.name}</h2>
                    )}
                    <p className="mt-1 text-xs text-text-muted capitalize">{lead.source}</p>
                  </div>
                  {lead.score !== null && (
                    <span
                      className={clsx(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        lead.score >= 80
                          ? "bg-success/10 text-success"
                          : lead.score >= 50
                            ? "bg-accent/10 text-accent"
                            : "bg-error/10 text-error"
                      )}
                    >
                      {lead.score}
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-text-muted" />
                    {editing ? (
                      <input
                        value={form.phone ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        className="w-full rounded-lg border border-border bg-background px-2 py-1 focus:border-primary focus:outline-none"
                      />
                    ) : (
                      <span>{lead.phone ?? "—"}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-text-muted" />
                    {editing ? (
                      <input
                        value={form.email ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        className="w-full rounded-lg border border-border bg-background px-2 py-1 focus:border-primary focus:outline-none"
                      />
                    ) : (
                      <span>{lead.email ?? "—"}</span>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-1.5 block text-xs font-semibold text-text-muted">
                    {t("actions.move")}
                  </label>
                  <select
                    value={lead.status}
                    onChange={(e) => changeStage(e.target.value as Stage)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {t(`kanban.${s}`)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={qualify}
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
                  {editing ? (
                    <button
                      onClick={save}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface-hover"
                    >
                      <Save className="h-4 w-4" />
                      {t("actions.edit")}
                    </button>
                  ) : (
                    <button
                      onClick={() => setEditing(true)}
                      className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface-hover"
                    >
                      {t("actions.edit")}
                    </button>
                  )}
                  <button
                    onClick={remove}
                    className="flex items-center gap-1.5 rounded-lg border border-error/40 px-3 py-2 text-sm font-medium text-error hover:bg-error/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("actions.delete")}
                  </button>
                </div>
              </div>
            </div>

            {/* Activities */}
            <div className="lg:col-span-2">
              <div className="rounded-xl border border-border bg-surface p-5">
                <p className="mb-3 text-sm font-semibold text-text-primary">
                  {t("activities.title")}
                </p>

                <div className="mb-4 space-y-2">
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

                {activities.length === 0 ? (
                  <p className="py-6 text-center text-xs text-text-muted">
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
                            {t.has(`activity.${a.activity_type}`)
                              ? t(`activity.${a.activity_type}`)
                              : a.activity_type}
                          </span>
                          <span className="text-[10px] text-text-muted">
                            {new Date(a.created_at).toLocaleString(
                              locale === "ar" ? "ar" : "en"
                            )}
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
        )}
      </div>
    </div>
  );
}
