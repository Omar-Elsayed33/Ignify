"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import DataTable, { Column } from "@/components/DataTable";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toaster";
import { useConfirm } from "@/components/ConfirmDialog";
import * as Tabs from "@radix-ui/react-tabs";
import { Plus, Trash2, AlertCircle, Loader2, Sparkles, FileText } from "lucide-react";
import { clsx } from "clsx";

interface ContentPost {
  id: string;
  title: string;
  body: string | null;
  post_type: "blog" | "social" | "email" | "ad_copy";
  platform: string | null;
  status: "draft" | "scheduled" | "published";
  created_at: string;
  [key: string]: unknown;
}

interface CreateForm {
  title: string;
  post_type: "blog" | "social" | "email" | "ad_copy";
  platform: string;
  body: string;
}

interface GenerateForm {
  topic: string;
  post_type: "blog" | "social" | "email" | "ad_copy";
  platform: string;
  tone: string;
}

const POST_TYPE_TAB_MAP: Record<string, string> = {
  blog: "blog",
  social: "social",
  email: "email",
  ad_copy: "ad copy",
};

export default function ContentPage() {
  const t = useTranslations("contentPage");
  const toast = useToast();
  const confirm = useConfirm();

  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>({
    title: "",
    post_type: "blog",
    platform: "",
    body: "",
  });

  const [generateOpen, setGenerateOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genForm, setGenForm] = useState<GenerateForm>({
    topic: "",
    post_type: "blog",
    platform: "",
    tone: "",
  });

  async function fetchPosts() {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<ContentPost[]>("/api/v1/content/posts");
      setPosts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load content");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPosts();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.title.trim()) return;
    try {
      setSubmitting(true);
      setFormError(null);
      const newPost = await api.post<ContentPost>("/api/v1/content/posts", {
        title: createForm.title,
        post_type: createForm.post_type,
        platform: createForm.platform || undefined,
        body: createForm.body || undefined,
        status: "draft",
      });
      setPosts((prev) => [newPost, ...prev]);
      setCreateOpen(false);
      setCreateForm({ title: "", post_type: "blog", platform: "", body: "" });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create post");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: "تأكيد",
      description: t("confirmDelete"),
      kind: "danger",
      confirmLabel: "حذف",
      cancelLabel: "إلغاء",
    });
    if (!ok) return;
    try {
      await api.delete(`/api/v1/content/posts/${id}`);
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete post";
      setError(msg);
      toast.error(msg);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!genForm.topic.trim()) return;
    try {
      setGenerating(true);
      setGenError(null);
      const result = await api.post<{ title: string; body: string }>("/api/v1/content/generate", {
        topic: genForm.topic,
        post_type: genForm.post_type,
        platform: genForm.platform || undefined,
        tone: genForm.tone || undefined,
      });
      // Save as draft automatically
      const newPost = await api.post<ContentPost>("/api/v1/content/posts", {
        title: result.title,
        body: result.body,
        post_type: genForm.post_type,
        platform: genForm.platform || undefined,
        status: "draft",
      });
      setPosts((prev) => [newPost, ...prev]);
      setGenerateOpen(false);
      setGenForm({ topic: "", post_type: "blog", platform: "", tone: "" });
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Failed to generate content");
    } finally {
      setGenerating(false);
    }
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-text-muted/10 text-text-muted",
      scheduled: "bg-accent/10 text-accent",
      published: "bg-success/10 text-success",
    };
    const labels: Record<string, string> = {
      draft: t("draft"),
      scheduled: t("scheduled"),
      published: t("published"),
    };
    return (
      <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", colors[status] ?? "bg-border text-text-muted")}>
        {labels[status] ?? status}
      </span>
    );
  };

  const columns: Column<ContentPost>[] = [
    { key: "title", label: t("contentTitle"), sortable: true },
    {
      key: "post_type",
      label: t("contentType"),
      sortable: true,
      render: (item) => <span className="capitalize">{item.post_type.replace("_", " ")}</span>,
    },
    {
      key: "platform",
      label: t("platform"),
      sortable: true,
      render: (item) => <span>{item.platform ?? "—"}</span>,
    },
    {
      key: "status",
      label: t("status"),
      render: (item) => statusBadge(item.status),
    },
    {
      key: "created_at",
      label: t("lastModified"),
      sortable: true,
      render: (item) => <span>{new Date(item.created_at).toLocaleDateString()}</span>,
    },
    {
      key: "id",
      label: "",
      render: (item) => (
        <button
          onClick={() => handleDelete(item.id)}
          className="rounded p-1 text-text-muted transition-colors hover:bg-error/10 hover:text-error"
          title={t("delete")}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ];

  const filteredPosts = activeTab === "all"
    ? posts
    : posts.filter((p) => POST_TYPE_TAB_MAP[p.post_type] === activeTab);

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
          <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
            <Tabs.List className="flex gap-1 rounded-lg bg-background p-1">
              {[
                { value: "all", label: t("allContent") },
                { value: "blog", label: t("blog") },
                { value: "social", label: t("socialTab") },
                { value: "email", label: t("emailTab") },
                { value: "ad copy", label: t("adCopy") },
              ].map((tab) => (
                <Tabs.Trigger
                  key={tab.value}
                  value={tab.value}
                  className={clsx(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    activeTab === tab.value
                      ? "bg-surface text-primary shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  )}
                >
                  {tab.label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Tabs.Root>

          <div className="flex gap-2">
            <button
              onClick={() => setGenerateOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5"
            >
              <Sparkles className="h-4 w-4" />
              {t("generateWithAI")}
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
            >
              <Plus className="h-4 w-4" />
              {t("createContent")}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredPosts.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            actionLabel={t("createContent")}
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          <DataTable
            columns={columns}
            data={filteredPosts as unknown as Record<string, unknown>[]}
            emptyTitle={t("emptyTitle")}
            emptyDescription={t("emptyDescription")}
          />
        )}
      </div>

      {/* Create Modal */}
      <Modal open={createOpen} onOpenChange={setCreateOpen} title={t("createContent")}>
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {formError}
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("contentTitle")}
            </label>
            <input
              type="text"
              required
              value={createForm.title}
              onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("contentType")}
            </label>
            <select
              value={createForm.post_type}
              onChange={(e) => setCreateForm((f) => ({ ...f, post_type: e.target.value as CreateForm["post_type"] }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="blog">Blog</option>
              <option value="social">Social</option>
              <option value="email">Email</option>
              <option value="ad_copy">Ad Copy</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("platform")}
            </label>
            <input
              type="text"
              value={createForm.platform}
              onChange={(e) => setCreateForm((f) => ({ ...f, platform: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("body")}
            </label>
            <textarea
              rows={4}
              value={createForm.body}
              onChange={(e) => setCreateForm((f) => ({ ...f, body: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
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
              {t("createContent")}
            </button>
          </div>
        </form>
      </Modal>

      {/* AI Generate Modal */}
      <Modal open={generateOpen} onOpenChange={setGenerateOpen} title={t("generateWithAI")}>
        <form onSubmit={handleGenerate} className="space-y-4">
          {genError && (
            <div className="flex items-center gap-2 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {genError}
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("topic")}
            </label>
            <input
              type="text"
              required
              value={genForm.topic}
              onChange={(e) => setGenForm((f) => ({ ...f, topic: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("contentType")}
            </label>
            <select
              value={genForm.post_type}
              onChange={(e) => setGenForm((f) => ({ ...f, post_type: e.target.value as GenerateForm["post_type"] }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="blog">Blog</option>
              <option value="social">Social</option>
              <option value="email">Email</option>
              <option value="ad_copy">Ad Copy</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("platform")}
            </label>
            <input
              type="text"
              value={genForm.platform}
              onChange={(e) => setGenForm((f) => ({ ...f, platform: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("tone")}
            </label>
            <input
              type="text"
              placeholder={t("tonePlaceholder")}
              value={genForm.tone}
              onChange={(e) => setGenForm((f) => ({ ...f, tone: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setGenerateOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={generating}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {t("generate")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
