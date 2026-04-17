"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import DashboardHeader from "@/components/DashboardHeader";
import EmptyState from "@/components/EmptyState";
import { api } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  Plus,
  Star,
  Pencil,
  Trash2,
  Sparkles,
  AlertCircle,
  Loader2,
  X,
  FileText,
} from "lucide-react";
import { clsx } from "clsx";

interface Template {
  id: string;
  name: string;
  type: string;
  channel: string | null;
  language: string;
  brief_template: string | null;
  system_prompt: string | null;
  is_favorite: boolean;
  created_at: string;
}

interface FormState {
  name: string;
  type: string;
  channel: string;
  language: string;
  brief_template: string;
  system_prompt: string;
}

const empty: FormState = {
  name: "",
  type: "post",
  channel: "instagram",
  language: "ar",
  brief_template: "",
  system_prompt: "",
};

export default function TemplatesPage() {
  const t = useTranslations("contentTemplates");
  const router = useRouter();
  const confirm = useConfirm();

  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const data = await api.get<Template[]>("/api/v1/content-templates");
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setEditingId(null);
    setForm(empty);
    setShowForm(true);
  }

  function openEdit(tpl: Template) {
    setEditingId(tpl.id);
    setForm({
      name: tpl.name,
      type: tpl.type,
      channel: tpl.channel || "",
      language: tpl.language,
      brief_template: tpl.brief_template || "",
      system_prompt: tpl.system_prompt || "",
    });
    setShowForm(true);
  }

  async function save() {
    try {
      setSaving(true);
      setError(null);
      const body = { ...form, channel: form.channel || null };
      if (editingId) {
        await api.patch(`/api/v1/content-templates/${editingId}`, body);
      } else {
        await api.post("/api/v1/content-templates", body);
      }
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleFav(tpl: Template) {
    try {
      await api.patch(`/api/v1/content-templates/${tpl.id}`, {
        is_favorite: !tpl.is_favorite,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function remove(tpl: Template) {
    const ok = await confirm({
      title: "تأكيد",
      description: t("confirmDelete"),
      kind: "danger",
      confirmLabel: "حذف",
      cancelLabel: "إلغاء",
    });
    if (!ok) return;
    try {
      await api.delete(`/api/v1/content-templates/${tpl.id}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function use(tpl: Template) {
    // Persist chosen template and redirect to generate page
    try {
      sessionStorage.setItem("ignify:contentTemplate", JSON.stringify(tpl));
    } catch {
      // noop
    }
    router.push("/content-gen");
  }

  return (
    <div>
      <DashboardHeader title={t("title")} />
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-text-secondary">{t("subtitle")}</p>
          <button
            onClick={openNew}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" />
            {t("new")}
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-4 py-2 text-sm text-error">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={t("empty")}
            description="احفظ بريفات جاهزة تعيد استخدامها عند توليد محتوى جديد لتوفر الوقت وتضمن نبرة موحدة."
            actionLabel={t("new")}
            onAction={openNew}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((tpl) => (
              <div
                key={tpl.id}
                className="flex flex-col rounded-xl border border-border bg-surface p-4"
              >
                <div className="mb-2 flex items-start justify-between">
                  <h3 className="text-sm font-semibold text-text-primary">{tpl.name}</h3>
                  <button
                    onClick={() => toggleFav(tpl)}
                    className={clsx(
                      "rounded-md p-1",
                      tpl.is_favorite
                        ? "text-amber-500"
                        : "text-text-muted hover:text-amber-500"
                    )}
                  >
                    <Star
                      className={clsx("h-4 w-4", tpl.is_favorite && "fill-current")}
                    />
                  </button>
                </div>
                <div className="mb-3 flex flex-wrap gap-1">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {tpl.type}
                  </span>
                  {tpl.channel && (
                    <span className="rounded-full bg-border px-2 py-0.5 text-xs text-text-secondary">
                      {tpl.channel}
                    </span>
                  )}
                  <span className="rounded-full bg-border px-2 py-0.5 text-xs text-text-secondary">
                    {tpl.language}
                  </span>
                </div>
                {tpl.brief_template && (
                  <p className="mb-3 line-clamp-3 text-xs text-text-secondary">
                    {tpl.brief_template}
                  </p>
                )}
                <div className="mt-auto flex gap-1 pt-2">
                  <button
                    onClick={() => use(tpl)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-white hover:bg-primary-dark"
                  >
                    <Sparkles className="h-3 w-3" />
                    {t("use")}
                  </button>
                  <button
                    onClick={() => openEdit(tpl)}
                    className="rounded-md border border-border p-1.5 text-text-secondary hover:bg-surface-hover"
                    title={t("edit")}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => remove(tpl)}
                    className="rounded-md border border-border p-1.5 text-text-muted hover:bg-error/10 hover:text-error"
                    title={t("delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">{editingId ? t("edit") : t("new")}</h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-md p-1 text-text-muted hover:bg-surface-hover"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium">{t("form.name")}</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium">{t("form.type")}</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
                  >
                    <option value="post">post</option>
                    <option value="caption">caption</option>
                    <option value="blog">blog</option>
                    <option value="ad_copy">ad_copy</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">{t("form.channel")}</label>
                  <input
                    value={form.channel}
                    onChange={(e) => setForm({ ...form, channel: e.target.value })}
                    className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">{t("form.language")}</label>
                  <select
                    value={form.language}
                    onChange={(e) => setForm({ ...form, language: e.target.value })}
                    className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
                  >
                    <option value="ar">ar</option>
                    <option value="en">en</option>
                    <option value="both">both</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">{t("form.brief")}</label>
                <textarea
                  rows={4}
                  placeholder={t("form.briefPlaceholder")}
                  value={form.brief_template}
                  onChange={(e) => setForm({ ...form, brief_template: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">
                  {t("form.systemPrompt")}
                </label>
                <textarea
                  rows={3}
                  value={form.system_prompt}
                  onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-md border border-border px-4 py-2 text-sm"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                onClick={save}
                disabled={saving || !form.name.trim()}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("form.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
