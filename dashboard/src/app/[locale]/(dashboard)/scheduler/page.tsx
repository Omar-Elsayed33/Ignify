"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import DashboardHeader from "@/components/DashboardHeader";
import EmptyState from "@/components/EmptyState";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toaster";
import { useConfirm } from "@/components/ConfirmDialog";
import Skeleton from "@/components/Skeleton";
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Hand,
  Plus,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import { clsx } from "clsx";

interface ScheduledPost {
  id: string;
  platform: string;
  scheduled_at: string | null;
  status: string;
  caption: string;
  media_urls: string[];
  external_id: string | null;
  error: string | null;
  content_post_id?: string | null;
  content_post_title?: string | null;
  publish_mode?: "auto" | "manual";
}

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-500/10 text-pink-500",
  facebook: "bg-blue-600/10 text-blue-600",
  twitter: "bg-sky-500/10 text-sky-500",
  linkedin: "bg-blue-700/10 text-blue-700",
  tiktok: "bg-text-primary/10 text-text-primary",
};

function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0 Sun .. 6 Sat
  // Treat Monday as start
  const diff = (day + 6) % 7;
  const res = new Date(d);
  res.setDate(d.getDate() - diff);
  res.setHours(0, 0, 0, 0);
  return res;
}

// First-day-of-week value (0 Sun .. 6 Sat) used by month grid.
function firstDayOfWeek(isArabic: boolean): number {
  return isArabic ? 6 : 0; // Sat for ar, Sun for en
}

function startOfMonthGrid(anchor: Date, weekStartDow: number): Date {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const dow = firstOfMonth.getDay();
  const back = (dow - weekStartDow + 7) % 7;
  const res = new Date(firstOfMonth);
  res.setDate(firstOfMonth.getDate() - back);
  res.setHours(0, 0, 0, 0);
  return res;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function SchedulerPage() {
  const t = useTranslations("scheduler");
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const locale = useLocale();
  const isAr = locale === "ar";
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"week" | "month">("week");
  const [monthAnchor, setMonthAnchor] = useState<Date>(new Date());

  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    return d;
  }, [weekStart]);

  const weekStartDow = firstDayOfWeek(isAr);
  const monthGridStart = useMemo(
    () => startOfMonthGrid(monthAnchor, weekStartDow),
    [monthAnchor, weekStartDow]
  );
  const monthGridEnd = useMemo(() => {
    const d = new Date(monthGridStart);
    d.setDate(d.getDate() + 42);
    return d;
  }, [monthGridStart]);

  const fetchPosts = useCallback(() => {
    setLoading(true);
    const from = view === "month" ? monthGridStart.toISOString() : weekStart.toISOString();
    const to = view === "month" ? monthGridEnd.toISOString() : weekEnd.toISOString();
    return api
      .get<ScheduledPost[]>(
        `/api/v1/social-scheduler/scheduled?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      )
      .then(setPosts)
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [view, weekStart, weekEnd, monthGridStart, monthGridEnd]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Conflict detection — same-platform posts scheduled within 30 min of each other.
  const conflictIds = useMemo(() => {
    const out = new Set<string>();
    const WINDOW_MS = 30 * 60 * 1000;
    const sorted = posts
      .filter((p) => !!p.scheduled_at)
      .slice()
      .sort((a, b) => {
        const byPlatform = a.platform.localeCompare(b.platform);
        if (byPlatform !== 0) return byPlatform;
        return (a.scheduled_at || "").localeCompare(b.scheduled_at || "");
      });
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (prev.platform !== curr.platform) continue;
      const diff = Math.abs(
        new Date(curr.scheduled_at as string).getTime() -
          new Date(prev.scheduled_at as string).getTime()
      );
      if (diff <= WINDOW_MS) {
        out.add(prev.id);
        out.add(curr.id);
      }
    }
    return out;
  }, [posts]);

  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  async function bulkShift() {
    if (selected.size === 0 || busy) return;
    const ids = Array.from(selected);
    setBusy(true);
    try {
      try {
        await api.post(`/api/v1/social-scheduler/scheduled/bulk-shift`, {
          ids,
          hours: 24,
        });
      } catch {
        // Backend bulk endpoint not available — no per-id PATCH exists either.
        toast.error(isAr ? "النقل الجماعي غير مدعوم حالياً" : "Bulk shift not supported yet");
        return;
      }
      toast.success(
        isAr ? `تم نقل ${ids.length} منشور` : `Shifted ${ids.length} post(s)`
      );
      setSelected(new Set());
      await fetchPosts();
    } finally {
      setBusy(false);
    }
  }

  async function bulkDelete() {
    if (selected.size === 0 || busy) return;
    const ids = Array.from(selected);
    const ok = await confirm({
      title: isAr ? "حذف" : "Delete",
      description: isAr ? `حذف ${ids.length} منشور؟` : `Delete ${ids.length} post(s)?`,
      kind: "danger",
      confirmLabel: isAr ? "حذف" : "Delete",
      cancelLabel: isAr ? "إلغاء" : "Cancel",
    });
    if (!ok) return;
    setBusy(true);
    let success = 0;
    try {
      for (const id of ids) {
        try {
          await api.delete(`/api/v1/social-scheduler/scheduled/${id}`);
          success += 1;
        } catch {
          // Continue through failures; final toast reports actual count.
        }
      }
      if (success > 0) {
        toast.success(
          isAr ? `تم حذف ${success} منشور` : `Deleted ${success} post(s)`
        );
      }
      if (success < ids.length) {
        toast.error(
          isAr
            ? `فشل حذف ${ids.length - success} منشور`
            : `Failed to delete ${ids.length - success} post(s)`
        );
      }
      setSelected(new Set());
      await fetchPosts();
    } finally {
      setBusy(false);
    }
  }

  async function markPublished(id: string) {
    const url = window.prompt(
      "أدخل رابط المنشور بعد نشره يدوياً (اختياري):",
      ""
    );
    if (url === null) return;
    try {
      await api.post(`/api/v1/social-scheduler/scheduled/${id}/mark-published`, {
        external_url: url || null,
      });
      setPosts((arr) =>
        arr.map((p) => (p.id === id ? { ...p, status: "published", external_id: url } : p))
      );
    } catch {
      toast.error("فشل التحديث");
    }
  }

  const days = useMemo(() => {
    return DAY_KEYS.map((key, idx) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + idx);
      return { key, date: d };
    });
  }, [weekStart]);

  const postsByDay = useMemo(() => {
    const map: Record<number, ScheduledPost[]> = {};
    for (const p of posts) {
      if (!p.scheduled_at) continue;
      const d = new Date(p.scheduled_at);
      const dayIdx = Math.floor((d.getTime() - weekStart.getTime()) / 86_400_000);
      if (dayIdx < 0 || dayIdx > 6) continue;
      (map[dayIdx] ||= []).push(p);
    }
    for (const k of Object.keys(map)) {
      map[+k].sort((a, b) =>
        (a.scheduled_at || "").localeCompare(b.scheduled_at || "")
      );
    }
    return map;
  }, [posts, weekStart]);

  const postsByDate = useMemo(() => {
    const map: Record<string, ScheduledPost[]> = {};
    for (const p of posts) {
      if (!p.scheduled_at) continue;
      const key = toISODate(new Date(p.scheduled_at));
      (map[key] ||= []).push(p);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) =>
        (a.scheduled_at || "").localeCompare(b.scheduled_at || "")
      );
    }
    return map;
  }, [posts]);

  const monthCells = useMemo(() => {
    const cells: { date: Date; inMonth: boolean }[] = [];
    const targetMonth = monthAnchor.getMonth();
    for (let i = 0; i < 42; i++) {
      const d = new Date(monthGridStart);
      d.setDate(monthGridStart.getDate() + i);
      cells.push({ date: d, inMonth: d.getMonth() === targetMonth });
    }
    // Trim trailing all-out-of-month week to reduce empty rows (5 rows when possible).
    if (cells.slice(35).every((c) => !c.inMonth)) {
      return cells.slice(0, 35);
    }
    return cells;
  }, [monthAnchor, monthGridStart]);

  const weekdayHeaders = useMemo(() => {
    const order: (typeof DAY_KEYS)[number][] = [];
    // DAY_KEYS is mon..sun. Build from weekStartDow (0 Sun .. 6 Sat).
    const jsOrder = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
    for (let i = 0; i < 7; i++) {
      order.push(jsOrder[(weekStartDow + i) % 7] as (typeof DAY_KEYS)[number]);
    }
    return order;
  }, [weekStartDow]);

  function jumpToWeek(date: Date) {
    setMonthAnchor(date);
    setView("week");
  }

  function prevMonth() {
    setMonthAnchor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setMonthAnchor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  const monthLabel = useMemo(() => {
    return monthAnchor.toLocaleDateString(isAr ? "ar" : "en", {
      month: "long",
      year: "numeric",
    });
  }, [monthAnchor, isAr]);

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {view === "week" ? t("calendar.thisWeek") : monthLabel}
            </h2>
            <p className="text-sm text-text-muted">{t("subtitle")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-2xl bg-surface-container-highest p-1">
              <button
                type="button"
                onClick={() => setView("week")}
                className={clsx(
                  "rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors",
                  view === "week"
                    ? "bg-surface-container-lowest text-text-primary shadow-soft"
                    : "bg-transparent text-text-muted hover:text-text-primary"
                )}
              >
                {isAr ? "أسبوع" : "Week"}
              </button>
              <button
                type="button"
                onClick={() => setView("month")}
                className={clsx(
                  "rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors",
                  view === "month"
                    ? "bg-surface-container-lowest text-text-primary shadow-soft"
                    : "bg-transparent text-text-muted hover:text-text-primary"
                )}
              >
                {isAr ? "شهر" : "Month"}
              </button>
            </div>
            {view === "month" && (
              <div className="inline-flex items-center gap-1 rounded-2xl border border-border bg-surface p-1">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="rounded-xl p-1.5 text-text-secondary hover:bg-surface-hover"
                  aria-label={isAr ? "الشهر السابق" : "Previous month"}
                >
                  <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                </button>
                <button
                  type="button"
                  onClick={() => setMonthAnchor(new Date())}
                  className="rounded-xl px-2 py-1 text-xs font-semibold text-text-secondary hover:bg-surface-hover"
                >
                  {isAr ? "اليوم" : "Today"}
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="rounded-xl p-1.5 text-text-secondary hover:bg-surface-hover"
                  aria-label={isAr ? "الشهر التالي" : "Next month"}
                >
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                </button>
              </div>
            )}
            <Link
              href="/scheduler/accounts"
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
            >
              <Users className="h-4 w-4" />
              {t("accounts.title")}
            </Link>
            <Link
              href="/scheduler/new"
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
            >
              <Plus className="h-4 w-4" />
              {t("calendar.newPost")}
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="min-h-[200px] rounded-xl border border-border bg-surface p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-8" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 && view === "week" ? (
          <EmptyState
            icon={Calendar}
            title="لا توجد منشورات مجدولة هذا الأسبوع"
            description="جدول منشوراتك على منصات التواصل ليتم نشرها تلقائياً أو متابعتها يدوياً."
            actionLabel={t("calendar.newPost")}
            onAction={() => router.push("/scheduler/new")}
          />
        ) : view === "week" ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
            {days.map((d, idx) => {
              const dayPosts = postsByDay[idx] || [];
              return (
                <div
                  key={d.key}
                  className="min-h-[200px] rounded-xl border border-border bg-surface p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                      {t(`calendar.days.${d.key}`)}
                    </span>
                    <span className="text-xs text-text-muted">
                      {d.date.getDate()}/{d.date.getMonth() + 1}
                    </span>
                  </div>
                  {dayPosts.length === 0 ? (
                    <div className="flex h-24 items-center justify-center text-center">
                      <span className="text-xs text-text-muted/70">
                        {t("calendar.empty")}
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dayPosts.map((p) => {
                        const time = p.scheduled_at
                          ? new Date(p.scheduled_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "--";
                        const color =
                          PLATFORM_COLORS[p.platform] ??
                          "bg-text-muted/10 text-text-muted";
                        const isManual = p.publish_mode === "manual";
                        const isScheduled = p.status === "scheduled";
                        const isSelected = selected.has(p.id);
                        const hasConflict = conflictIds.has(p.id);
                        return (
                          <div
                            key={p.id}
                            className={clsx(
                              "relative rounded-lg border bg-background p-2 ps-7 text-xs transition-colors",
                              isSelected
                                ? "border-primary ring-1 ring-primary"
                                : "border-border"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelected(p.id)}
                              aria-label={isAr ? "تحديد" : "Select"}
                              className="absolute top-2 start-2 h-3.5 w-3.5 cursor-pointer accent-primary"
                            />
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className="font-medium text-text-primary">{time}</span>
                              <span
                                className={clsx(
                                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold capitalize",
                                  color
                                )}
                              >
                                {p.platform}
                              </span>
                            </div>
                            {hasConflict && (
                              <div
                                className="mb-1 inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700"
                                title={
                                  isAr
                                    ? "منشور آخر على نفس المنصة خلال 30 دقيقة"
                                    : "Another post on the same platform within 30 minutes"
                                }
                              >
                                <AlertTriangle className="h-2.5 w-2.5" />
                                {isAr ? "تعارض" : "Conflict"}
                              </div>
                            )}
                            {p.content_post_title && (
                              <div className="mb-1 flex items-center gap-1 text-[10px] text-primary">
                                <FileText className="h-3 w-3 shrink-0" />
                                <span className="truncate">{p.content_post_title}</span>
                              </div>
                            )}
                            <p className="line-clamp-2 text-text-secondary">{p.caption}</p>
                            <div className="mt-1 flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1">
                                <span
                                  className={clsx(
                                    "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                                    isManual
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-emerald-100 text-emerald-700"
                                  )}
                                  title={isManual ? "يدوي" : "تلقائي"}
                                >
                                  {isManual ? <Hand className="h-2.5 w-2.5" /> : <Zap className="h-2.5 w-2.5" />}
                                  {isManual ? "يدوي" : "تلقائي"}
                                </span>
                                <span className="text-[10px] capitalize text-text-muted">{p.status}</span>
                              </div>
                              {isManual && isScheduled && (
                                <button
                                  type="button"
                                  onClick={() => markPublished(p.id)}
                                  className="flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-white hover:brightness-110"
                                  title="تأكيد النشر"
                                >
                                  <Check className="h-2.5 w-2.5" />
                                  نشرت
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            <div className="mb-2 grid grid-cols-7 gap-3">
              {weekdayHeaders.map((key) => (
                <div
                  key={key}
                  className="text-center text-xs font-semibold uppercase tracking-wider text-text-muted"
                >
                  {t(`calendar.days.${key}`)}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-3">
              {monthCells.map(({ date, inMonth }) => {
                const key = toISODate(date);
                const dayPosts = postsByDate[key] || [];
                const extra = Math.max(0, dayPosts.length - 3);
                const visible = dayPosts.slice(0, 3);
                return (
                  <div
                    key={key}
                    className={clsx(
                      "min-h-[120px] rounded-xl border border-border bg-surface p-2 text-xs transition-colors",
                      !inMonth && "opacity-40"
                    )}
                  >
                    <div className="mb-1 flex items-center justify-start">
                      <span className="text-xs font-semibold text-text-primary">
                        {date.getDate()}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {visible.map((p) => {
                        const time = p.scheduled_at
                          ? new Date(p.scheduled_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "--";
                        const color =
                          PLATFORM_COLORS[p.platform] ??
                          "bg-text-muted/10 text-text-muted";
                        const isSelected = selected.has(p.id);
                        const hasConflict = conflictIds.has(p.id);
                        const isManual = p.publish_mode === "manual";
                        return (
                          <div
                            key={p.id}
                            className={clsx(
                              "relative flex items-center gap-1 rounded-md border bg-background px-1.5 py-1 ps-5 text-[10px] transition-colors",
                              isSelected
                                ? "border-primary ring-1 ring-primary"
                                : "border-border"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelected(p.id)}
                              aria-label={isAr ? "تحديد" : "Select"}
                              className="absolute top-1/2 start-1 h-3 w-3 -translate-y-1/2 cursor-pointer accent-primary"
                            />
                            <span
                              className={clsx(
                                "shrink-0 rounded-full px-1 py-[1px] text-[8px] font-bold capitalize",
                                color
                              )}
                              title={p.platform}
                            >
                              {p.platform.slice(0, 2)}
                            </span>
                            <span className="shrink-0 font-medium text-text-primary">
                              {time}
                            </span>
                            {hasConflict && (
                              <AlertTriangle
                                className="h-2.5 w-2.5 shrink-0 text-red-600"
                                aria-label={isAr ? "تعارض" : "Conflict"}
                              />
                            )}
                            {isManual ? (
                              <Hand className="h-2.5 w-2.5 shrink-0 text-amber-600" />
                            ) : (
                              <Zap className="h-2.5 w-2.5 shrink-0 text-emerald-600" />
                            )}
                          </div>
                        );
                      })}
                      {extra > 0 && (
                        <button
                          type="button"
                          onClick={() => jumpToWeek(date)}
                          className="block w-full rounded-md px-1 py-0.5 text-start text-[10px] font-semibold text-primary hover:underline"
                        >
                          {isAr ? `+${extra} منشور` : `+${extra} more`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <div className="fixed inset-x-4 bottom-20 z-30 mx-auto flex max-w-xl items-center justify-between rounded-3xl bg-on-surface px-5 py-3 text-surface shadow-[0_8px_30px_rgba(0,0,0,0.3)] lg:bottom-4">
          <span className="text-sm font-semibold">
            {isAr ? `${selected.size} محدد` : `${selected.size} selected`}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={bulkShift}
              disabled={busy}
              className="flex items-center gap-1 rounded-full bg-surface/10 px-3 py-1.5 text-xs font-semibold hover:bg-surface/20 disabled:opacity-50"
              title={isAr ? "نقل يوم واحد" : "Shift by 1 day"}
            >
              <Clock className="h-3.5 w-3.5" />
              {isAr ? "نقل يوم" : "+1 day"}
            </button>
            <button
              type="button"
              onClick={bulkDelete}
              disabled={busy}
              className="flex items-center gap-1 rounded-full bg-red-500/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isAr ? "حذف" : "Delete"}
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              disabled={busy}
              className="flex items-center gap-1 rounded-full bg-surface/10 px-3 py-1.5 text-xs font-semibold hover:bg-surface/20 disabled:opacity-50"
              title={isAr ? "إلغاء التحديد" : "Clear"}
            >
              <X className="h-3.5 w-3.5" />
              {isAr ? "إلغاء" : "Clear"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
