"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import DataTable, { Column } from "@/components/DataTable";
import Modal from "@/components/Modal";
import { api } from "@/lib/api";
import { Plus, LayoutGrid, List, AlertCircle, Loader2, Users } from "lucide-react";
import { clsx } from "clsx";

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: "whatsapp" | "messenger" | "instagram" | "website" | "ads" | "manual";
  score: number | null;
  status: "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";
  created_at: string;
  [key: string]: unknown;
}

interface AddForm {
  name: string;
  email: string;
  phone: string;
  company: string;
  source: Lead["source"];
  score: string;
  status: Lead["status"];
}

const stages: Lead["status"][] = ["new", "contacted", "qualified", "proposal", "won", "lost"];

const stageColors: Record<string, string> = {
  new: "border-info bg-info/5",
  contacted: "border-accent bg-accent/5",
  qualified: "border-primary bg-primary/5",
  proposal: "border-purple-500 bg-purple-500/5",
  won: "border-success bg-success/5",
  lost: "border-error bg-error/5",
};

export default function LeadsPage() {
  const t = useTranslations("leadsPage");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"pipeline" | "list">("pipeline");

  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<AddForm>({
    name: "",
    email: "",
    phone: "",
    company: "",
    source: "manual",
    score: "",
    status: "new",
  });

  async function fetchLeads() {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<Lead[]>("/api/v1/leads/");
      setLeads(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLeads();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.name.trim()) return;
    try {
      setSubmitting(true);
      setFormError(null);
      const newLead = await api.post<Lead>("/api/v1/leads/", {
        name: addForm.name,
        email: addForm.email || undefined,
        phone: addForm.phone || undefined,
        company: addForm.company || undefined,
        source: addForm.source,
        score: addForm.score ? parseInt(addForm.score, 10) : undefined,
        status: addForm.status,
      });
      setLeads((prev) => [newLead, ...prev]);
      setAddOpen(false);
      setAddForm({ name: "", email: "", phone: "", company: "", source: "manual", score: "", status: "new" });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add lead");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateStatus(id: string, status: Lead["status"]) {
    try {
      const updated = await api.put<Lead>(`/api/v1/leads/${id}`, { status });
      setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update lead");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await api.delete(`/api/v1/leads/${id}`);
      setLeads((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete lead");
    }
  }

  const scoreBadge = (score: number | null) => {
    if (score === null) return <span className="text-xs text-text-muted">—</span>;
    const color = score >= 80 ? "bg-success/10 text-success" : score >= 60 ? "bg-accent/10 text-accent" : "bg-error/10 text-error";
    return <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-semibold", color)}>{score}</span>;
  };

  const columns: Column<Lead>[] = [
    { key: "name", label: t("name"), sortable: true },
    { key: "email", label: "Email", render: (item) => <span>{item.email ?? "—"}</span> },
    { key: "company", label: t("company"), sortable: true, render: (item) => <span>{item.company ?? "—"}</span> },
    { key: "source", label: t("source"), render: (item) => <span className="capitalize">{item.source}</span> },
    {
      key: "status",
      label: t("status"),
      render: (item) => (
        <select
          value={item.status}
          onChange={(e) => handleUpdateStatus(item.id, e.target.value as Lead["status"])}
          className="rounded border border-border bg-transparent px-2 py-0.5 text-xs focus:border-primary focus:outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          {stages.map((s) => (
            <option key={s} value={s}>{t(s)}</option>
          ))}
        </select>
      ),
    },
    { key: "score", label: t("leadScore"), render: (item) => scoreBadge(item.score) },
    {
      key: "id",
      label: "",
      render: (item) => (
        <button
          onClick={() => handleDelete(item.id)}
          className="rounded p-1 text-text-muted transition-colors hover:bg-error/10 hover:text-error"
          title={t("delete")}
        >
          <span className="text-xs">✕</span>
        </button>
      ),
    },
  ];

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

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 rounded-lg bg-background p-1">
            <button
              onClick={() => setView("pipeline")}
              className={clsx(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
                view === "pipeline" ? "bg-surface text-primary shadow-sm" : "text-text-secondary"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              {t("pipeline")}
            </button>
            <button
              onClick={() => setView("list")}
              className={clsx(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
                view === "list" ? "bg-surface text-primary shadow-sm" : "text-text-secondary"
              )}
            >
              <List className="h-4 w-4" />
              {t("listView")}
            </button>
          </div>

          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" />
            {t("addLead")}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : view === "pipeline" ? (
          leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
              <Users className="h-10 w-10 text-text-muted" />
              <p className="mt-3 text-sm font-medium text-text-primary">{t("emptyTitle")}</p>
              <p className="mt-1 text-sm text-text-muted">{t("emptyDescription")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="flex gap-4 pb-2" style={{ minWidth: "max-content" }}>
                {stages.map((stage) => {
                  const stageLeads = leads.filter((l) => l.status === stage);
                  return (
                    <div key={stage} className="w-[200px]">
                      <div className={clsx("mb-3 rounded-lg border-s-4 px-3 py-2", stageColors[stage])}>
                        <p className="text-sm font-semibold text-text-primary">{t(stage)}</p>
                        <p className="text-xs text-text-muted">{stageLeads.length} {t("leads")}</p>
                      </div>
                      <div className="space-y-2">
                        {stageLeads.map((lead) => (
                          <div
                            key={lead.id}
                            className="cursor-pointer rounded-lg border border-border bg-surface p-3 shadow-sm transition-shadow hover:shadow-md"
                          >
                            <p className="text-sm font-medium text-text-primary">{lead.name}</p>
                            <p className="mt-0.5 text-xs text-text-muted">{lead.company ?? "—"}</p>
                            <div className="mt-2 flex items-center justify-between">
                              <span className="text-xs capitalize text-text-muted">{lead.source}</span>
                              {scoreBadge(lead.score)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          <DataTable
            columns={columns}
            data={leads as unknown as Record<string, unknown>[]}
            emptyTitle={t("emptyTitle")}
            emptyDescription={t("emptyDescription")}
          />
        )}
      </div>

      <Modal open={addOpen} onOpenChange={setAddOpen} title={t("addLead")}>
        <form onSubmit={handleAdd} className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {formError}
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("name")}</label>
            <input
              type="text"
              required
              value={addForm.name}
              onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Email</label>
            <input
              type="email"
              value={addForm.email}
              onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("phone")}</label>
            <input
              type="tel"
              value={addForm.phone}
              onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("company")}</label>
            <input
              type="text"
              value={addForm.company}
              onChange={(e) => setAddForm((f) => ({ ...f, company: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("source")}</label>
              <select
                value={addForm.source}
                onChange={(e) => setAddForm((f) => ({ ...f, source: e.target.value as AddForm["source"] }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="manual">Manual</option>
                <option value="website">Website</option>
                <option value="ads">Ads</option>
                <option value="instagram">Instagram</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="messenger">Messenger</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("leadScore")}</label>
              <input
                type="number"
                min="0"
                max="100"
                value={addForm.score}
                onChange={(e) => setAddForm((f) => ({ ...f, score: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("status")}</label>
            <select
              value={addForm.status}
              onChange={(e) => setAddForm((f) => ({ ...f, status: e.target.value as AddForm["status"] }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {stages.map((s) => (
                <option key={s} value={s}>{t(s)}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("addLead")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
