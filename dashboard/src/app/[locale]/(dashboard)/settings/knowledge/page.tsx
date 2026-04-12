"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import { api } from "@/lib/api";
import {
  AlertCircle,
  Database,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";

type Source = "faq" | "product" | "policy" | "custom";

interface Chunk {
  id: string;
  tenant_id: string;
  source: Source;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface FormState {
  id?: string;
  title: string;
  content: string;
  source: Source;
}

const EMPTY_FORM: FormState = { title: "", content: "", source: "custom" };

export default function KnowledgeBasePage() {
  const t = useTranslations("knowledgeBase");
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const rows = await api.get<Chunk[]>("/api/v1/knowledge");
      setChunks(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return chunks;
    const q = search.toLowerCase();
    return chunks.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.content.toLowerCase().includes(q)
    );
  }, [chunks, search]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) return;
    try {
      setSaving(true);
      setError(null);
      if (form.id) {
        await api.patch(`/api/v1/knowledge/${form.id}`, {
          title: form.title,
          content: form.content,
          source: form.source,
        });
      } else {
        await api.post("/api/v1/knowledge", {
          title: form.title,
          content: form.content,
          source: form.source,
        });
      }
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await api.delete(`/api/v1/knowledge/${id}`);
      setChunks((cs) => cs.filter((c) => c.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.deleteFailed"));
    }
  }

  function parseImport(raw: string): { title: string; content: string; source?: Source }[] {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    // Try JSON first
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((x) => x && typeof x.title === "string" && typeof x.content === "string")
          .map((x) => ({
            title: String(x.title),
            content: String(x.content),
            source: x.source as Source | undefined,
          }));
      }
      if (parsed && Array.isArray(parsed.chunks)) {
        return parsed.chunks as { title: string; content: string; source?: Source }[];
      }
    } catch {
      // fall through to CSV
    }
    // CSV: title,content[,source] — one row per line
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
    const out: { title: string; content: string; source?: Source }[] = [];
    for (const line of lines) {
      const parts = line.split(",");
      if (parts.length < 2) continue;
      const [title, ...rest] = parts;
      const content = rest.slice(0, rest.length - (rest.length > 1 ? 1 : 0)).join(",") || rest[0];
      const source = rest.length > 1 ? (rest[rest.length - 1].trim() as Source) : undefined;
      out.push({ title: title.trim(), content: content.trim(), source });
    }
    return out;
  }

  async function handleImport() {
    const items = parseImport(importText);
    if (!items.length) {
      setError(t("errors.importEmpty"));
      return;
    }
    try {
      setImporting(true);
      setError(null);
      await api.post("/api/v1/knowledge/bulk-import", { chunks: items });
      setImportOpen(false);
      setImportText("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.importFailed"));
    } finally {
      setImporting(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setImportText(text);
  }

  return (
    <div>
      <DashboardHeader title={t("title")} />
      <div className="p-6">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
                <Database className="h-5 w-5 text-primary" />
                {t("heading")}
              </h2>
              <p className="mt-1 text-sm text-text-secondary">{t("subtitle")}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-hover"
              >
                <Upload className="h-4 w-4" />
                {t("bulkImport")}
              </button>
              <button
                onClick={() => {
                  setForm(EMPTY_FORM);
                  setShowForm(true);
                }}
                className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark"
              >
                <Plus className="h-4 w-4" />
                {t("addChunk")}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full rounded-lg border border-border bg-background ps-9 pe-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {showForm && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">
                  {form.id ? t("editChunk") : t("addChunk")}
                </h3>
                <button
                  onClick={resetForm}
                  className="rounded p-1 text-text-muted hover:bg-surface-hover"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    {t("fields.title")}
                  </label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    {t("fields.source")}
                  </label>
                  <select
                    value={form.source}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, source: e.target.value as Source }))
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="custom">{t("sources.custom")}</option>
                    <option value="faq">{t("sources.faq")}</option>
                    <option value="product">{t("sources.product")}</option>
                    <option value="policy">{t("sources.policy")}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    {t("fields.content")}
                  </label>
                  <textarea
                    rows={6}
                    value={form.content}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, content: e.target.value }))
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={resetForm}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-hover"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {t("save")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {importOpen && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">
                  {t("bulkImport")}
                </h3>
                <button
                  onClick={() => setImportOpen(false)}
                  className="rounded p-1 text-text-muted hover:bg-surface-hover"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mb-2 text-xs text-text-secondary">
                {t("importHelp")}
              </p>
              <input
                type="file"
                accept=".json,.csv,.txt"
                onChange={handleFileUpload}
                className="mb-2 block text-sm"
              />
              <textarea
                rows={8}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='[{"title":"Hours","content":"9-5 weekdays","source":"faq"}]'
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
              />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  onClick={() => setImportOpen(false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-hover"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
                >
                  {importing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {t("import")}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-text-muted">
              {t("empty")}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-border bg-surface p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {t(`sources.${c.source}`)}
                        </span>
                        <h4 className="truncate text-sm font-semibold text-text-primary">
                          {c.title}
                        </h4>
                      </div>
                      <p className="mt-1 line-clamp-3 text-sm text-text-secondary">
                        {c.content}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => {
                          setForm({
                            id: c.id,
                            title: c.title,
                            content: c.content,
                            source: c.source,
                          });
                          setShowForm(true);
                        }}
                        className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface-hover"
                      >
                        {t("edit")}
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="rounded-lg border border-error/30 px-2 py-1 text-xs font-medium text-error hover:bg-error/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
