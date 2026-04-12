"use client";

import { useEffect, useState, use } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import DashboardHeader from "@/components/DashboardHeader";
import { api } from "@/lib/api";
import {
  ArrowLeft,
  AlertCircle,
  Loader2,
  Send,
  Check,
  X,
  Rocket,
  MessageSquare,
  Clock,
} from "lucide-react";
import { clsx } from "clsx";

type Status = "draft" | "review" | "approved" | "rejected" | "scheduled" | "published";

interface Post {
  id: string;
  title: string;
  body: string | null;
  post_type: string;
  platform: string | null;
  status: Status;
  created_at: string;
  published_at: string | null;
  metadata?: Record<string, unknown>;
}

interface Activity {
  id: string;
  content_post_id: string;
  user_id: string | null;
  action: string;
  note: string | null;
  created_at: string;
}

interface Me {
  id: string;
  role: string;
}

const STATUS_COLORS: Record<Status, string> = {
  draft: "bg-text-muted/10 text-text-muted",
  review: "bg-amber-500/10 text-amber-600",
  approved: "bg-success/10 text-success",
  rejected: "bg-error/10 text-error",
  scheduled: "bg-primary/10 text-primary",
  published: "bg-blue-500/10 text-blue-600",
};

export default function ContentDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("contentWorkflow");
  const router = useRouter();

  const [post, setPost] = useState<Post | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [comment, setComment] = useState("");

  async function reload() {
    const [p, a] = await Promise.all([
      api.get<Post>(`/api/v1/content/posts/${id}`),
      api.get<Activity[]>(`/api/v1/content/posts/${id}/activity`),
    ]);
    setPost(p);
    setActivity(a);
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [m] = await Promise.all([
          api.get<Me>("/api/v1/users/me").catch(() => null as unknown as Me),
          reload(),
        ]);
        if (m) setMe(m);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const canReview = me
    ? ["owner", "admin", "editor", "superadmin"].includes(me.role)
    : false;

  async function action(path: string, body?: unknown) {
    try {
      setBusy(true);
      setError(null);
      await api.post(`/api/v1/content/posts/${id}/${path}`, body ?? {});
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitComment() {
    if (!comment.trim()) return;
    try {
      setBusy(true);
      await api.post(`/api/v1/content/posts/${id}/comment`, { note: comment });
      setComment("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div>
        <DashboardHeader title={t("activityTitle")} />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!post) return null;

  return (
    <div>
      <DashboardHeader title={post.title} />
      <div className="p-6">
        <button
          onClick={() => router.push("/content")}
          className="mb-4 flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t("activityTitle")}
        </button>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-4 py-2 text-sm text-error">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="mb-3 flex items-center gap-3">
                <span
                  className={clsx(
                    "rounded-full px-3 py-1 text-xs font-medium",
                    STATUS_COLORS[post.status]
                  )}
                >
                  {t(`statusLabel.${post.status}`)}
                </span>
                {post.platform && (
                  <span className="text-xs text-text-muted">{post.platform}</span>
                )}
              </div>
              <h2 className="mb-2 text-lg font-semibold text-text-primary">
                {post.title}
              </h2>
              <p className="whitespace-pre-wrap text-sm text-text-secondary">
                {post.body}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-4">
              {post.status === "draft" && (
                <button
                  disabled={busy}
                  onClick={() => action("submit-review")}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  {t("submitReview")}
                </button>
              )}
              {post.status === "review" && canReview && (
                <>
                  <button
                    disabled={busy}
                    onClick={() => action("approve")}
                    className="flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" />
                    {t("approve")}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setShowReject(true)}
                    className="flex items-center gap-2 rounded-lg bg-error px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                  >
                    <X className="h-4 w-4" />
                    {t("reject")}
                  </button>
                </>
              )}
              {post.status === "approved" && (
                <button
                  disabled={busy}
                  onClick={() => action("publish-now")}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
                >
                  <Rocket className="h-4 w-4" />
                  {t("publishNow")}
                </button>
              )}
            </div>

            {showReject && (
              <div className="rounded-xl border border-border bg-surface p-4">
                <label className="mb-2 block text-sm font-medium">
                  {t("rejectReason")}
                </label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    onClick={() => setShowReject(false)}
                    className="rounded-md border border-border px-3 py-1.5 text-sm"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    disabled={busy}
                    onClick={async () => {
                      await action("reject", { reason: rejectReason });
                      setShowReject(false);
                      setRejectReason("");
                    }}
                    className="rounded-md bg-error px-3 py-1.5 text-sm font-medium text-white"
                  >
                    {t("reject")}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-surface p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4 text-primary" />
                {t("activityTitle")}
              </h3>
              {activity.length === 0 ? (
                <p className="text-xs text-text-muted">—</p>
              ) : (
                <ol className="space-y-3">
                  {activity.map((a) => (
                    <li
                      key={a.id}
                      className="flex gap-2 border-s-2 border-border ps-3 text-xs"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-text-primary">
                          {["submit_review", "approve", "reject", "publish", "comment"].includes(a.action)
                            ? t(`actions.${a.action as "submit_review" | "approve" | "reject" | "publish" | "comment"}`)
                            : a.action}
                        </div>
                        {a.note && (
                          <div className="mt-0.5 text-text-secondary">{a.note}</div>
                        )}
                        <div className="mt-0.5 text-text-muted">
                          {new Date(a.created_at).toLocaleString()}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="h-4 w-4 text-primary" />
                {t("comments")}
              </h3>
              <textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t("addComment")}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <div className="mt-2 flex justify-end">
                <button
                  disabled={busy || !comment.trim()}
                  onClick={submitComment}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                >
                  {t("post")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
