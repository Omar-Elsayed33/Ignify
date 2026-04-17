"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useLocale } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import Button from "@/components/Button";
import InsightChip from "@/components/InsightChip";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import { Input, Textarea } from "@/components/FormField";
import { api } from "@/lib/api";
import {
  AlertCircle,
  Loader2,
  Plus,
  X,
  Sparkles,
  Phone,
  Mail,
  Users,
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

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-tertiary-fixed px-2 py-0.5 font-headline text-[10px] font-bold text-on-tertiary-fixed-variant">
      <Sparkles className="h-2.5 w-2.5" />
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

      <div className="p-8">
        <div className="space-y-8">
          <PageHeader
            eyebrow="PIPELINE"
            title={t("title")}
            description={t("subtitle")}
            actions={
              <Button
                onClick={() => setAddOpen(true)}
                leadingIcon={<Plus className="h-4 w-4" />}
              >
                {t("form.new")}
              </Button>
            }
          />

          {error && (
            <Card padding="sm" className="flex items-center gap-3 !bg-error-container">
              <AlertCircle className="h-4 w-4 shrink-0 text-on-error-container" />
              <span className="text-sm font-medium text-on-error-container">{error}</span>
            </Card>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : columns.every((c) => c.leads.length === 0) ? (
            <EmptyState
              icon={Users}
              title="لا يوجد عملاء محتملون بعد"
              description="أضف أول عميل محتمل أو اربط قنوات الاستقبال لتبدأ بتتبع خط البيع الخاص بك."
              actionLabel={t("form.new")}
              onAction={() => setAddOpen(true)}
            />
          ) : (
            <div className="overflow-x-auto">
              <div className="flex gap-4 pb-4" style={{ minWidth: "max-content" }}>
                {columns.map((col) => (
                  <div
                    key={col.stage}
                    className="flex w-[300px] shrink-0 flex-col rounded-2xl bg-surface-container-low p-3"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/lead-id") || dragLeadId;
                      if (id) moveLead(id, col.stage);
                      setDragLeadId(null);
                    }}
                  >
                    <div className="mb-4 flex items-center justify-between px-1">
                      <span className="brand-gradient-bg inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-headline text-[10px] font-bold uppercase tracking-widest text-white shadow-soft">
                        {t(`kanban.${col.stage}`)}
                      </span>
                      <span className="rounded-full bg-surface-container-lowest px-2 py-0.5 font-headline text-xs font-bold text-on-surface-variant">
                        {col.leads.length}
                      </span>
                    </div>
                    <div className="flex min-h-[100px] flex-col gap-3">
                      {col.leads.length === 0 ? (
                        <div className="rounded-xl bg-surface-container-lowest/50 px-3 py-10 text-center text-xs font-medium text-on-surface-variant">
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
                              "group cursor-grab rounded-2xl bg-surface-container-lowest p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:bg-surface-bright active:cursor-grabbing",
                              dragLeadId === lead.id && "opacity-50"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-headline line-clamp-1 text-sm font-bold text-on-surface">
                                {lead.name}
                              </p>
                              <ScoreBadge score={lead.score} />
                            </div>
                            <div className="mt-2 space-y-1">
                              {lead.phone && (
                                <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                                  <Phone className="h-3 w-3" />
                                  <span className="truncate">{lead.phone}</span>
                                </div>
                              )}
                              {lead.email && (
                                <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                                  <Mail className="h-3 w-3" />
                                  <span className="truncate">{lead.email}</span>
                                </div>
                              )}
                            </div>
                            <div className="mt-3 flex items-center justify-between">
                              <span className="rounded-full bg-surface-container-low px-2 py-0.5 font-headline text-[10px] font-bold uppercase text-on-surface-variant">
                                {t.has(`source.${lead.source}`) ? t(`source.${lead.source}`) : lead.source}
                              </span>
                              <Link
                                href={`/${locale}/leads/${lead.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="font-headline text-[11px] font-bold text-primary opacity-0 transition-opacity group-hover:opacity-100 hover:underline"
                              >
                                {t("card.viewDetails")}
                              </Link>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      <Modal open={addOpen} onOpenChange={setAddOpen} title={t("form.new")}>
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 rounded-xl bg-error-container px-3 py-2 text-sm text-on-error-container">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {formError}
            </div>
          )}
          <Input
            label={t("form.name")}
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("form.phone")}
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <Input
              label={t("form.email")}
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <label className="block space-y-1.5">
            <span className="font-headline text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
              {t("form.source")}
            </span>
            <select
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as Source }))}
              className="w-full rounded-xl bg-surface-container-low px-4 py-2.5 text-sm text-on-surface outline-none transition-all focus:ring-2 focus:ring-primary/30"
            >
              <option value="manual">{t("source.manual")}</option>
              <option value="whatsapp">{t("source.whatsapp")}</option>
              <option value="instagram">{t("source.instagram")}</option>
              <option value="messenger">{t("source.facebook")}</option>
              <option value="website">{t("source.website")}</option>
              <option value="ads">Ads</option>
              <option value="other">{t("source.other")}</option>
            </select>
          </label>
          <Textarea
            label={t("form.notes")}
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>
              {tPage("cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
              leadingIcon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
            >
              {t("form.submit")}
            </Button>
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
          <div className="w-full max-w-md overflow-y-auto bg-surface-container-lowest shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between bg-surface-container-lowest px-6 py-5">
              <div>
                <InsightChip>{t(`kanban.${drawerLead.status}`)}</InsightChip>
                <p className="font-headline mt-2 text-xl font-bold tracking-tight text-on-surface">
                  {drawerLead.name}
                </p>
              </div>
              <button
                onClick={() => setDrawerLead(null)}
                className="rounded-xl p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <Card variant="flat" padding="md" className="space-y-2">
                {drawerLead.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-on-surface-variant" />
                    <span>{drawerLead.phone}</span>
                  </div>
                )}
                {drawerLead.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-on-surface-variant" />
                    <span>{drawerLead.email}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2">
                  <span className="rounded-full bg-surface-container-lowest px-2 py-0.5 font-headline text-[10px] font-bold uppercase text-on-surface-variant">
                    {t.has(`source.${drawerLead.source}`) ? t(`source.${drawerLead.source}`) : drawerLead.source}
                  </span>
                  {drawerLead.score !== null && <ScoreBadge score={drawerLead.score} />}
                </div>
              </Card>

              <div className="flex gap-2">
                <Button
                  onClick={qualifyLead}
                  disabled={qualifying}
                  className="flex-1"
                  leadingIcon={
                    qualifying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )
                  }
                >
                  {qualifying ? t("actions.qualifying") : t("actions.qualify")}
                </Button>
                <select
                  value={drawerLead.status}
                  onChange={(e) => {
                    const s = e.target.value as Stage;
                    moveLead(drawerLead.id, s);
                    setDrawerLead({ ...drawerLead, status: s });
                  }}
                  className="rounded-xl bg-surface-container-low px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {t(`kanban.${s}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <h3 className="mb-3 font-headline text-base font-bold tracking-tight text-on-surface">
                  {t("activities.title")}
                </h3>
                <div className="mb-4 space-y-2">
                  <Textarea
                    rows={2}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder={t("activities.addNote")}
                  />
                  <Button
                    onClick={addNote}
                    disabled={!noteText.trim()}
                    size="sm"
                  >
                    {t("activities.addNote")}
                  </Button>
                </div>

                {loadingActivities ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : activities.length === 0 ? (
                  <p className="py-4 text-center text-xs text-on-surface-variant">
                    {t("activities.empty")}
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {activities.map((a) => (
                      <li
                        key={a.id}
                        className="rounded-xl bg-surface-container-low p-4"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-primary">
                            {t.has(`activity.${a.activity_type}`) ? t(`activity.${a.activity_type}`) : a.activity_type}
                          </span>
                          <span className="text-[10px] text-on-surface-variant">
                            {new Date(a.created_at).toLocaleString(locale === "ar" ? "ar" : "en")}
                          </span>
                        </div>
                        {a.description && (
                          <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-on-surface-variant">
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
