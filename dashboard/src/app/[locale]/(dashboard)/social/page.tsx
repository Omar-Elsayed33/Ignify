"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import { api } from "@/lib/api";
import {
  Plus,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  Loader2,
  X,
  Users,
  Trash2,
} from "lucide-react";
import { clsx } from "clsx";

// ── Types matching backend snake_case responses ──

interface SocialAccount {
  id: string;
  tenant_id: string;
  platform: string;
  account_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

interface SocialPost {
  id: string;
  tenant_id: string;
  social_account_id: string;
  content: string;
  media_urls: string[] | null;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  external_post_id: string | null;
  created_at: string;
}

// Social platform → display colour
const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-500/10 text-pink-500",
  facebook: "bg-blue-600/10 text-blue-600",
  twitter: "bg-sky-500/10 text-sky-500",
  linkedin: "bg-blue-700/10 text-blue-700",
  tiktok: "bg-text-primary/10 text-text-primary",
  snapchat: "bg-yellow-400/10 text-yellow-500",
};

const POST_STATUSES = ["draft", "scheduled", "published"] as const;

export default function SocialPage() {
  const t = useTranslations("socialPage");

  // ── State ──
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterAccountId, setFilterAccountId] = useState<string>("");

  const [form, setForm] = useState({
    social_account_id: "",
    content: "",
    status: "draft" as string,
    scheduled_at: "",
  });

  // ── Fetch accounts ──
  useEffect(() => {
    setLoadingAccounts(true);
    api
      .get<SocialAccount[]>("/api/v1/social/accounts")
      .then(setAccounts)
      .catch(() => setAccounts([]))
      .finally(() => setLoadingAccounts(false));
  }, []);

  // ── Fetch posts (with optional account filter) ──
  useEffect(() => {
    setLoadingPosts(true);
    const endpoint = filterAccountId
      ? `/api/v1/social/posts?account_id=${filterAccountId}`
      : "/api/v1/social/posts";
    api
      .get<SocialPost[]>(endpoint)
      .then(setPosts)
      .catch(() => setPosts([]))
      .finally(() => setLoadingPosts(false));
  }, [filterAccountId]);

  // ── Create post ──
  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    if (!form.social_account_id || !form.content.trim()) {
      setCreateError("Account and content are required.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const payload = {
        social_account_id: form.social_account_id,
        content: form.content.trim(),
        status: form.status,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
        media_urls: [],
      };
      const created = await api.post<SocialPost>("/api/v1/social/posts", payload);
      setPosts((prev) => [created, ...prev]);
      setShowCreatePost(false);
      setForm({ social_account_id: "", content: "", status: "draft", scheduled_at: "" });
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Failed to create post");
    } finally {
      setCreating(false);
    }
  }

  // ── Delete post ──
  async function handleDeletePost(postId: string) {
    setDeletingId(postId);
    try {
      await api.delete(`/api/v1/social/posts/${postId}`);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch {
      // silently fail — could show toast
    } finally {
      setDeletingId(null);
    }
  }

  // ── Resolve account for a post ──
  function accountForPost(post: SocialPost): SocialAccount | undefined {
    return accounts.find((a) => a.id === post.social_account_id);
  }

  // ── Status badge ──
  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-info/10 text-info",
      scheduled: "bg-accent/10 text-accent",
      published: "bg-success/10 text-success",
      failed: "bg-error/10 text-error",
    };
    return (
      <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", colors[status] ?? "bg-text-muted/10 text-text-muted")}>
        {status}
      </span>
    );
  };

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        {/* Connected Accounts */}
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-text-secondary">
            {t("connectedAccounts")}
          </h3>
          {loadingAccounts ? (
            <div className="flex items-center gap-2 text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading accounts…</span>
            </div>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-text-muted">No social accounts connected yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {accounts.map((account) => {
                const platformColor =
                  PLATFORM_COLORS[account.platform.toLowerCase()] ??
                  "bg-text-muted/10 text-text-muted";
                return (
                  <div
                    key={account.id}
                    className="rounded-xl border border-border bg-surface p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={clsx("rounded-full px-2 py-0.5 text-xs font-semibold capitalize", platformColor)}>
                          {account.platform}
                        </span>
                        <span className="truncate text-sm font-medium text-text-primary">
                          {account.name}
                        </span>
                      </div>
                      <span
                        className={clsx(
                          "h-2 w-2 flex-shrink-0 rounded-full",
                          account.is_active ? "bg-success" : "bg-text-muted"
                        )}
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
                      <Users className="h-3.5 w-3.5" />
                      {account.account_id}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Posts Header */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-text-primary">{t("recentPosts")}</h3>
            {accounts.length > 0 && (
              <select
                value={filterAccountId}
                onChange={(e) => setFilterAccountId(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All accounts</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            )}
          </div>
          <button
            onClick={() => setShowCreatePost(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" />
            {t("schedulePost")}
          </button>
        </div>

        {/* Posts List */}
        {loadingPosts ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center">
            <MessageCircle className="mx-auto mb-3 h-10 w-10 text-text-muted/40" />
            <p className="text-sm text-text-muted">No posts yet. Create your first post.</p>
            <button
              onClick={() => setShowCreatePost(true)}
              className="mt-4 text-sm font-medium text-primary hover:underline"
            >
              {t("schedulePost")}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => {
              const acct = accountForPost(post);
              const platformColor =
                PLATFORM_COLORS[acct?.platform.toLowerCase() ?? ""] ??
                "bg-text-muted/10 text-text-muted";
              return (
                <div
                  key={post.id}
                  className="rounded-xl border border-border bg-surface p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {acct && (
                          <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", platformColor)}>
                            {acct.platform}
                          </span>
                        )}
                        {acct && (
                          <span className="text-xs text-text-muted">{acct.name}</span>
                        )}
                        {statusBadge(post.status)}
                        {post.scheduled_at && (
                          <span className="text-xs text-text-muted">
                            Scheduled: {new Date(post.scheduled_at).toLocaleString()}
                          </span>
                        )}
                        {post.published_at && (
                          <span className="text-xs text-text-muted">
                            Published: {new Date(post.published_at).toLocaleString()}
                          </span>
                        )}
                        {!post.scheduled_at && !post.published_at && (
                          <span className="text-xs text-text-muted">
                            {new Date(post.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 line-clamp-3 text-sm text-text-primary">{post.content}</p>
                    </div>
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      disabled={deletingId === post.id}
                      className="flex-shrink-0 rounded-lg p-1.5 text-text-muted hover:bg-error/10 hover:text-error disabled:opacity-40"
                    >
                      {deletingId === post.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {/* Media URLs */}
                  {post.media_urls && post.media_urls.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {post.media_urls.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary underline-offset-2 hover:underline"
                        >
                          Media {i + 1}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Placeholder metric row — real metrics live at /posts/{id}/metrics */}
                  <div className="mt-4 flex gap-6 border-t border-border pt-3">
                    <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                      <Heart className="h-4 w-4" />
                      <span className="text-text-muted">—</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                      <MessageCircle className="h-4 w-4" />
                      <span className="text-text-muted">—</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                      <Share2 className="h-4 w-4" />
                      <span className="text-text-muted">—</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                      <Eye className="h-4 w-4" />
                      <span className="text-text-muted">—</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Post Modal */}
      {showCreatePost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-surface p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">{t("schedulePost")}</h2>
              <button
                onClick={() => { setShowCreatePost(false); setCreateError(null); }}
                className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {createError && (
              <div className="mb-4 rounded-lg bg-error/10 px-4 py-2.5 text-sm text-error">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreatePost} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Account *</label>
                <select
                  required
                  value={form.social_account_id}
                  onChange={(e) => setForm((f) => ({ ...f, social_account_id: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select account…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.platform})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Content *</label>
                <textarea
                  required
                  rows={4}
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  placeholder="Write your post content…"
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {POST_STATUSES.map((s) => (
                    <option key={s} value={s} className="capitalize">{s}</option>
                  ))}
                </select>
              </div>

              {form.status === "scheduled" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">Schedule Date & Time</label>
                  <input
                    type="datetime-local"
                    value={form.scheduled_at}
                    onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreatePost(false); setCreateError(null); }}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
                >
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("schedulePost")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
