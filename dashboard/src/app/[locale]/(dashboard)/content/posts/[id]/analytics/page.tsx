"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import PageHeader from "@/components/PageHeader";
import Skeleton from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { api, ApiError } from "@/lib/api";
import {
  ArrowLeft,
  BarChart3,
  Eye,
  MousePointerClick,
  Heart,
  Activity,
  Calendar,
  Instagram,
  Facebook,
  Twitter,
  Linkedin,
  Video as VideoIcon,
  Share2,
  Globe,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Post {
  id: string;
  title: string;
  body: string | null;
  post_type: string;
  platform: string | null;
  status: string;
  created_at: string;
  published_at: string | null;
  metadata?: Record<string, unknown>;
}

interface TimeseriesPoint {
  date: string;
  value: number;
}

interface Metrics {
  reach?: number | null;
  impressions?: number | null;
  engagement_rate?: number | null;
  clicks?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  timeseries?: TimeseriesPoint[];
}

function platformIcon(platform: string | null | undefined) {
  switch ((platform || "").toLowerCase()) {
    case "instagram":
      return Instagram;
    case "facebook":
      return Facebook;
    case "twitter":
    case "x":
      return Twitter;
    case "linkedin":
      return Linkedin;
    case "tiktok":
      return VideoIcon;
    default:
      return Globe;
  }
}

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatPercent(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  // Accept either 0.032 or 3.2 style — heuristic: if <= 1 treat as fraction
  const pct = n <= 1 ? n * 100 : n;
  return `${pct.toFixed(1)}%`;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function PostAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = use(params);
  const locale = useLocale();
  const isAr = locale === "ar";

  const [post, setPost] = useState<Post | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loadingPost, setLoadingPost] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [metricsMissing, setMetricsMissing] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<Post>(`/api/v1/content/posts/${id}`);
        if (!cancelled) setPost(data);
      } catch (err) {
        if (!cancelled)
          setPostError(
            err instanceof Error
              ? err.message
              : isAr
                ? "تعذر تحميل المنشور"
                : "Failed to load post"
          );
      } finally {
        if (!cancelled) setLoadingPost(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isAr]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMetrics(true);
      setMetricsMissing(false);
      try {
        const data = await api.get<Metrics>(
          `/api/v1/analytics/content/${id}/metrics`
        );
        if (!cancelled) setMetrics(data || {});
      } catch (err) {
        const is404 = err instanceof ApiError && err.status === 404;
        if (!is404) {
          if (!cancelled) {
            setMetrics({});
            setLoadingMetrics(false);
          }
          return;
        }
        // Try fallback
        try {
          const data = await api.get<Metrics>(
            `/api/v1/analytics/posts/${id}`
          );
          if (!cancelled) setMetrics(data || {});
        } catch (err2) {
          const is404b = err2 instanceof ApiError && err2.status === 404;
          if (!cancelled) {
            if (is404b) setMetricsMissing(true);
            setMetrics({});
          }
        }
      } finally {
        if (!cancelled) setLoadingMetrics(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const PlatformIcon = platformIcon(post?.platform);

  const chartData = useMemo(() => {
    const ts = metrics?.timeseries;
    if (!ts || !Array.isArray(ts) || ts.length === 0) return [];
    return ts.map((p) => ({
      date: p.date,
      value: typeof p.value === "number" ? p.value : 0,
    }));
  }, [metrics]);

  const statCards = [
    {
      key: "reach",
      label: isAr ? "الوصول" : "Reach",
      value: metrics?.reach,
      icon: Eye,
      accent: "bg-blue-500/10 text-blue-600",
      isPercent: false,
    },
    {
      key: "impressions",
      label: isAr ? "الانطباعات" : "Impressions",
      value: metrics?.impressions,
      icon: BarChart3,
      accent: "bg-violet-500/10 text-violet-600",
      isPercent: false,
    },
    {
      key: "engagement_rate",
      label: isAr ? "معدل التفاعل" : "Engagement rate",
      value: metrics?.engagement_rate,
      icon: Heart,
      accent: "bg-pink-500/10 text-pink-600",
      isPercent: true,
    },
    {
      key: "clicks",
      label: isAr ? "النقرات" : "Clicks",
      value: metrics?.clicks,
      icon: MousePointerClick,
      accent: "bg-emerald-500/10 text-emerald-600",
      isPercent: false,
    },
  ];

  const headerTitle = isAr ? "تحليلات المنشور" : "Post Analytics";

  return (
    <div>
      <DashboardHeader title={headerTitle} />
      <div className="p-8">
        <div className="space-y-6">
          <Link
            href="/content"
            className="inline-flex items-center gap-2 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {isAr ? "العودة للمحتوى" : "Back to content"}
          </Link>

          {/* Post header */}
          {loadingPost ? (
            <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-soft">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-6 w-3/4" />
              <Skeleton className="mt-2 h-3 w-1/3" />
            </div>
          ) : postError ? (
            <EmptyState
              icon={BarChart3}
              title={isAr ? "تعذر تحميل المنشور" : "Could not load post"}
              description={postError}
            />
          ) : post ? (
            <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-soft">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                    <PlatformIcon className="h-3.5 w-3.5" />
                    <span>{post.platform || (isAr ? "منشور" : "Post")}</span>
                    <span className="opacity-50">•</span>
                    <span>{post.status}</span>
                  </div>
                  <h2 className="mt-2 font-headline text-xl font-bold text-on-surface">
                    {post.title}
                  </h2>
                  <div className="mt-2 flex items-center gap-2 text-sm text-on-surface-variant">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {isAr ? "نُشر" : "Published"}:{" "}
                      {formatDate(post.published_at || post.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <PageHeader
            eyebrow={isAr ? "تحليلات" : "ANALYTICS"}
            title={isAr ? "الأداء" : "Performance"}
            description={
              isAr
                ? "مقاييس أداء هذا المنشور على مدى آخر 28 يوماً."
                : "Performance metrics for this post over the last 28 days."
            }
          />

          {metricsMissing ? (
            <EmptyState
              icon={Activity}
              title={isAr ? "جاري ربط التحليلات..." : "Connecting analytics..."}
              description={
                isAr
                  ? "نعمل على جلب بيانات الأداء من المنصة. سيظهر التحليل خلال دقائق من نشر المنشور."
                  : "We're fetching performance data from the platform. Analytics appear a few minutes after publishing."
              }
            />
          ) : (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {statCards.map((s) => {
                  const Icon = s.icon;
                  const hasValue = s.value !== null && s.value !== undefined;
                  return (
                    <div
                      key={s.key}
                      className="rounded-2xl bg-surface-container-lowest p-5 shadow-soft"
                    >
                      {loadingMetrics ? (
                        <>
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="mt-3 h-8 w-24" />
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                              {s.label}
                            </span>
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-xl ${s.accent}`}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                          </div>
                          <p className="mt-3 font-headline text-2xl font-bold text-on-surface">
                            {hasValue
                              ? s.isPercent
                                ? formatPercent(s.value)
                                : formatNumber(s.value)
                              : "—"}
                          </p>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Time-series chart */}
              <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-soft">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-headline text-lg font-bold text-on-surface">
                      {isAr ? "الأداء عبر الوقت" : "Performance over time"}
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      {isAr ? "آخر 28 يوماً" : "Last 28 days"}
                    </p>
                  </div>
                </div>
                {loadingMetrics ? (
                  <Skeleton className="h-64 w-full" />
                ) : chartData.length === 0 ? (
                  <EmptyState
                    icon={Activity}
                    title={isAr ? "لا توجد بيانات بعد" : "No data yet"}
                    description={
                      isAr
                        ? "لا تتوفر بيانات زمنية لهذا المنشور حتى الآن."
                        : "No time-series data is available for this post yet."
                    }
                  />
                ) : (
                  <div style={{ width: "100%", height: 300 }}>
                    <ResponsiveContainer>
                      <LineChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="currentColor"
                          strokeWidth={2}
                          dot={false}
                          className="text-primary"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Secondary metrics (only if present) */}
              {(metrics?.likes !== undefined ||
                metrics?.comments !== undefined ||
                metrics?.shares !== undefined) && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {[
                    {
                      key: "likes",
                      label: isAr ? "الإعجابات" : "Likes",
                      value: metrics?.likes,
                      icon: Heart,
                    },
                    {
                      key: "comments",
                      label: isAr ? "التعليقات" : "Comments",
                      value: metrics?.comments,
                      icon: Activity,
                    },
                    {
                      key: "shares",
                      label: isAr ? "المشاركات" : "Shares",
                      value: metrics?.shares,
                      icon: Share2,
                    },
                  ].map((s) => {
                    const Icon = s.icon;
                    return (
                      <div
                        key={s.key}
                        className="flex items-center justify-between rounded-2xl bg-surface-container-low p-4"
                      >
                        <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                          <Icon className="h-4 w-4" />
                          <span>{s.label}</span>
                        </div>
                        <span className="font-headline text-base font-bold text-on-surface">
                          {formatNumber(s.value)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
