"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import DashboardHeader from "@/components/DashboardHeader";
import PlatformPreview from "@/components/PlatformPreview";
import { api } from "@/lib/api";
import { Loader2, Sparkles, Zap, Hand, FileText } from "lucide-react";
import { clsx } from "clsx";

interface BestTimeSuggestion {
  day: string;
  hour: number;
  score: number;
}

interface ContentPostLite {
  id: string;
  title: string;
  body: string;
  platform: string | null;
  metadata: Record<string, unknown> | null;
}

const ALL_PLATFORMS = [
  "facebook",
  "instagram",
  "linkedin",
  "twitter",
  "youtube",
  "tiktok",
  "snapchat",
] as const;

const DAY_TO_WEEKDAY: Record<string, number> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 0,
};

function nextDateForSuggestion(day: string, hour: number): Date {
  const target = DAY_TO_WEEKDAY[day] ?? 1;
  const now = new Date();
  const d = new Date(now);
  const diff = (target - now.getDay() + 7) % 7 || 7;
  d.setDate(now.getDate() + diff);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function toInputDateTime(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NewScheduledPostPage() {
  const t = useTranslations("scheduler");
  const isAr = useLocale() === "ar";
  const router = useRouter();
  const searchParams = useSearchParams();
  const contentPostId = searchParams.get("content_post_id");

  const [caption, setCaption] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["facebook"]);
  const [mediaUrlsText, setMediaUrlsText] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingBest, setLoadingBest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishMode, setPublishMode] = useState<"auto" | "manual">("auto");
  const [linkedPost, setLinkedPost] = useState<ContentPostLite | null>(null);

  // Prefill from a ContentPost if ?content_post_id= is present
  useEffect(() => {
    if (!contentPostId) return;
    api
      .get<ContentPostLite>(`/api/v1/content/posts/${contentPostId}`)
      .then((p) => {
        setLinkedPost(p);
        setCaption(p.body || "");
        if (p.platform) setPlatforms([p.platform]);
      })
      .catch(() => setLinkedPost(null));
  }, [contentPostId]);

  function togglePlatform(p: string) {
    setPlatforms((list) =>
      list.includes(p) ? list.filter((x) => x !== p) : [...list, p]
    );
  }

  async function handleSuggestBestTime() {
    setLoadingBest(true);
    try {
      const res = await api.get<{ suggestions: BestTimeSuggestion[] }>(
        "/api/v1/social-scheduler/best-times"
      );
      const best = [...(res.suggestions || [])].sort(
        (a, b) => (b.score ?? 0) - (a.score ?? 0)
      )[0];
      if (best) {
        const d = nextDateForSuggestion(best.day, best.hour);
        setScheduledAt(toInputDateTime(d));
      }
    } catch {
      setError(t("errors.failed"));
    } finally {
      setLoadingBest(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!caption.trim() || platforms.length === 0 || !scheduledAt) {
      setError(t("errors.failed"));
      return;
    }
    setSubmitting(true);
    try {
      const media_urls = mediaUrlsText
        .split(/\s|,|\n/)
        .map((u) => u.trim())
        .filter(Boolean);
      await api.post("/api/v1/social-scheduler/schedule", {
        platforms,
        scheduled_at: new Date(scheduledAt).toISOString(),
        caption: caption.trim(),
        media_urls,
        content_post_id: contentPostId || undefined,
        publish_mode: publishMode,
      });
      router.push("/scheduler");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  const mediaUrlsList = mediaUrlsText
    .split(/\s|,|\n/)
    .map((u) => u.trim())
    .filter(Boolean);
  const firstMediaUrl = mediaUrlsList[0] || null;

  return (
    <div>
      <DashboardHeader title={t("calendar.newPost")} />
      <div className="p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-xl border border-border bg-surface p-6"
        >
          {error && (
            <div className="rounded-lg bg-error/10 px-4 py-2.5 text-sm text-error">
              {error}
            </div>
          )}

          {linkedPost && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="font-medium text-emerald-800">
                مرتبط بالمقال: {linkedPost.title}
              </span>
            </div>
          )}

          {/* Publish mode toggle */}
          <div>
            <label className="mb-2 block text-sm font-medium text-text-secondary">
              وضع النشر
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPublishMode("auto")}
                className={clsx(
                  "flex items-start gap-3 rounded-xl border-2 p-3 text-start transition-all",
                  publishMode === "auto"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background hover:bg-surface-hover"
                )}
              >
                <Zap className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold text-text-primary">نشر تلقائي</p>
                  <p className="text-xs text-text-muted">
                    ينشر تلقائياً في الوقت المحدد عبر الحسابات المربوطة
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPublishMode("manual")}
                className={clsx(
                  "flex items-start gap-3 rounded-xl border-2 p-3 text-start transition-all",
                  publishMode === "manual"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background hover:bg-surface-hover"
                )}
              >
                <Hand className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-text-primary">نشر يدوي</p>
                  <p className="text-xs text-text-muted">
                    تذكيرك بالوقت وأنت تنشر يدوياً ثم تأكّد النشر
                  </p>
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">
              {t("form.caption")}
            </label>
            <textarea
              rows={5}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t("form.captionPlaceholder")}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-text-secondary">
              {t("form.platforms")}
            </label>
            <div className="flex flex-wrap gap-3">
              {ALL_PLATFORMS.map((p) => (
                <label
                  key={p}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"
                >
                  <input
                    type="checkbox"
                    checked={platforms.includes(p)}
                    onChange={() => togglePlatform(p)}
                    className="h-4 w-4"
                  />
                  <span className="capitalize">{p}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">
              {t("form.mediaUrls")}
            </label>
            <textarea
              rows={2}
              value={mediaUrlsText}
              onChange={(e) => setMediaUrlsText(e.target.value)}
              placeholder="https://…"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium text-text-secondary">
                {t("form.scheduledAt")}
              </label>
              <button
                type="button"
                onClick={handleSuggestBestTime}
                disabled={loadingBest}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-60"
              >
                {loadingBest ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {t("form.bestTime")}
              </button>
            </div>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? t("form.scheduling") : t("form.submit")}
            </button>
          </div>
        </form>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">
              {isAr ? "معاينة" : "Preview"}
            </h3>
            {platforms.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-xs text-text-muted">
                {isAr ? "اختر منصة لعرض المعاينة" : "Pick a platform to see a preview"}
              </div>
            ) : (
              <div className="space-y-4">
                {platforms.map((p) => (
                  <PlatformPreview
                    key={p}
                    platform={p}
                    caption={caption}
                    mediaUrl={firstMediaUrl}
                  />
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
