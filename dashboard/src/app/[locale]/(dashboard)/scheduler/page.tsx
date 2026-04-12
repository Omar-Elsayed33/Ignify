"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import DashboardHeader from "@/components/DashboardHeader";
import { api } from "@/lib/api";
import { Calendar, Plus, Loader2, Users } from "lucide-react";
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

export default function SchedulerPage() {
  const t = useTranslations("scheduler");
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);

  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    return d;
  }, [weekStart]);

  useEffect(() => {
    setLoading(true);
    const from = weekStart.toISOString();
    const to = weekEnd.toISOString();
    api
      .get<ScheduledPost[]>(`/api/v1/social-scheduler/scheduled?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then(setPosts)
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [weekStart, weekEnd]);

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

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {t("calendar.thisWeek")}
            </h2>
            <p className="text-sm text-text-muted">{t("subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
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
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
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
                        return (
                          <div
                            key={p.id}
                            className="rounded-lg border border-border bg-background p-2 text-xs"
                          >
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className="font-medium text-text-primary">
                                {time}
                              </span>
                              <span
                                className={clsx(
                                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold capitalize",
                                  color
                                )}
                              >
                                {p.platform}
                              </span>
                            </div>
                            <p className="line-clamp-2 text-text-secondary">
                              {p.caption}
                            </p>
                            <div className="mt-1 flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-text-muted" />
                              <span className="text-[10px] capitalize text-text-muted">
                                {p.status}
                              </span>
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
        )}
      </div>
    </div>
  );
}
