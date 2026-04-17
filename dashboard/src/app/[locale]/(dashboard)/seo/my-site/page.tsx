"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toaster";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  Loader2,
  Globe,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  Sparkles,
  Gauge,
  FileText,
  ShieldCheck,
  Zap,
  BarChart3,
  ExternalLink,
  TrendingUp,
  Eye,
  MousePointerClick,
  Users,
} from "lucide-react";
import Skeleton, { SkeletonStatCard } from "@/components/Skeleton";
import { clsx } from "clsx";

// ─── Types ───────────────────────────────────────────────────────────────

interface PageResult {
  url: string;
  score: number;
  title: string;
  meta_description: string;
  word_count: number;
  h1_count: number;
  issues: Array<{
    code: string;
    severity: string;
    label_ar: string;
    label_en: string;
    fix_ar: string;
    fix_en: string;
    current?: unknown;
  }>;
}

interface SiteIssue {
  code: string;
  severity: string;
  label_ar: string;
  label_en: string;
  fix_ar: string;
  fix_en: string;
}

interface Recommendation {
  id: string;
  category: string;
  title: string;
  why: string;
  how: string;
  priority: string;
  expected_impact: string;
}

interface DeepAuditResult {
  url: string;
  origin: string;
  score: number;
  summary: {
    pages_audited: number;
    avg_page_score: number;
    total_words: number;
    total_images: number;
    images_without_alt: number;
    pages_missing_title: number;
    pages_missing_meta_description: number;
    pages_missing_h1: number;
    thin_content_pages: number;
  };
  site_files: {
    robots_txt_found: boolean;
    sitemap_xml_found: boolean;
    sitemap_url?: string | null;
  };
  site_issues: SiteIssue[];
  pages: PageResult[];
  recommendations: Recommendation[];
  audit_id?: string;
}

interface IntegrationStatus {
  oauth_configured: boolean;
  search_console: {
    connected: boolean;
    site_url?: string | null;
    last_sync?: string | null;
    data?: SearchConsoleData | null;
  };
  analytics: {
    connected: boolean;
    property_id?: string | null;
    last_sync?: string | null;
    data?: AnalyticsData | null;
  };
  setup_note: string;
}

interface SearchConsoleRow {
  query?: string;
  page?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface SearchConsoleData {
  period_days: number;
  start: string;
  end: string;
  top_queries: SearchConsoleRow[];
  top_pages: SearchConsoleRow[];
}

interface AnalyticsRow {
  date?: string;
  page?: string;
  channel?: string;
  activeUsers?: number;
  sessions?: number;
  screenPageViews?: number;
}

interface AnalyticsData {
  period_days: number;
  daily: AnalyticsRow[];
  top_pages: AnalyticsRow[];
  traffic_sources: AnalyticsRow[];
}

interface Site { siteUrl: string; permissionLevel?: string }
interface Property { property_id: string; display_name?: string; account?: string }

// ─── Helpers ──────────────────────────────────────────────────────────────

const PRIORITY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: "bg-rose-100", text: "text-rose-700", label: "عالية" },
  medium: { bg: "bg-amber-100", text: "text-amber-700", label: "متوسطة" },
  low: { bg: "bg-slate-100", text: "text-slate-700", label: "منخفضة" },
};

const CATEGORY_STYLE: Record<string, { color: string; label_ar: string }> = {
  "technical-seo": { color: "text-blue-600", label_ar: "سيو تقني" },
  content: { color: "text-purple-600", label_ar: "محتوى" },
  conversion: { color: "text-emerald-600", label_ar: "تحويلات" },
  trust: { color: "text-amber-600", label_ar: "ثقة" },
  technical: { color: "text-slate-600", label_ar: "تقني" },
};

function scoreColor(s: number | null | undefined): string {
  if (s == null) return "#9ca3af";
  if (s >= 80) return "#10b981";
  if (s >= 50) return "#f59e0b";
  return "#ef4444";
}

// ─── Page ────────────────────────────────────────────────────────────────

export default function MySiteSEOPage() {
  const t = useTranslations("seoAudit");
  const locale = useLocale();
  const isAr = locale === "ar";

  const [url, setUrl] = useState("");
  const [lang, setLang] = useState<"ar" | "en">(isAr ? "ar" : "en");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DeepAuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);
  const [activePageIdx, setActivePageIdx] = useState(0);

  const refreshIntegrations = () => {
    api
      .get<IntegrationStatus>("/api/v1/seo/integrations")
      .then(setIntegrations)
      .catch(() => setIntegrations(null));
  };

  // Prefill URL from tenant profile
  useEffect(() => {
    (async () => {
      try {
        const s = await api.get<{ business_profile?: { website?: string } }>(
          "/api/v1/onboarding/status"
        );
        if (s?.business_profile?.website) setUrl(s.business_profile.website);
      } catch {
        // ignore
      }
    })();
    refreshIntegrations();
    // After OAuth callback ?connected=... — clear the query from the URL
    if (typeof window !== "undefined" && new URL(window.location.href).searchParams.get("connected")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const runAudit = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setActivePageIdx(0);
    try {
      const r = await api.post<DeepAuditResult>("/api/v1/seo/audit/deep", {
        url: url.trim(),
        language: lang,
      });
      setResult(r);
    } catch {
      setError(isAr ? "فشل تحليل الموقع" : "Audit failed");
    } finally {
      setLoading(false);
    }
  };

  const s = result?.score ?? null;
  const currentPage = result?.pages[activePageIdx];

  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      <div className="brand-gradient rounded-3xl p-[2px] shadow-soft-lg">
        <div className="rounded-[22px] bg-surface-container-lowest p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-headline text-xs font-bold uppercase tracking-widest text-primary">
                  AI · SEO INTELLIGENCE
                </span>
              </div>
              <h1 className="font-headline text-3xl font-bold tracking-tight text-on-surface md:text-4xl">
                {isAr ? "تحليل موقعك بعمق" : "Deep site analysis"}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-on-surface-variant">
                {isAr
                  ? "نحلّل صفحات موقعك الرئيسية ونقرأ محتواها لإعطائك توصيات محددة لتحسين السيو وزيادة التحويلات — ليست نصائح عامة."
                  : "We audit your site's key pages and read the content to give you specific SEO + conversion recommendations — not generic tips."}
              </p>
            </div>
          </div>

          {/* URL input */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Globe className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://yourbusiness.com"
                className="w-full rounded-xl bg-surface-container-low ps-10 pe-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
                onKeyDown={(e) => {
                  if (e.key === "Enter") runAudit();
                }}
              />
            </div>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as "ar" | "en")}
              className="rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="ar">AR</option>
              <option value="en">EN</option>
            </select>
            <button
              type="button"
              onClick={runAudit}
              disabled={!url.trim() || loading}
              className="brand-gradient-bg flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold text-white shadow-soft transition-all hover:brightness-105 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {loading
                ? isAr
                  ? "جارٍ التحليل..."
                  : "Analyzing..."
                : result
                ? isAr
                  ? "إعادة التحليل"
                  : "Re-audit"
                : isAr
                ? "ابدأ التحليل"
                : "Start audit"}
            </button>
          </div>
          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>
      </div>

      {/* ── Loading skeleton (audit running) ── */}
      {loading && !result && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonStatCard key={i} />
            ))}
          </div>
          <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-soft">
            <Skeleton className="h-5 w-1/3" />
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-surface-container-low p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Skeleton className="h-4 w-14 rounded-full" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="mt-2 h-3 w-full" />
                  <Skeleton className="mt-1 h-3 w-5/6" />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Results ── */}
      {result && (
        <>
          {/* Top stats row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {/* Score */}
            <div className="rounded-2xl bg-surface-container-lowest p-5 shadow-soft">
              <div className="flex items-center gap-2 mb-3">
                <Gauge className="h-4 w-4 text-primary" />
                <span className="font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  {isAr ? "النتيجة" : "Score"}
                </span>
              </div>
              <div className="relative mx-auto h-28 w-28">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke={scoreColor(s)}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${((s ?? 0) / 100) * 264} 264`}
                  />
                </svg>
                <div
                  className="absolute inset-0 flex items-center justify-center font-headline text-3xl font-bold"
                  style={{ color: scoreColor(s) }}
                >
                  {s ?? "—"}
                </div>
              </div>
            </div>

            {/* Pages audited */}
            <div className="rounded-2xl bg-surface-container-lowest p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <FileText className="h-5 w-5 text-primary" />
                <span className="text-xs font-semibold text-emerald-600">
                  {isAr ? "مُدقّقة" : "Audited"}
                </span>
              </div>
              <p className="mt-3 font-headline text-3xl font-bold text-on-surface">
                {result.summary.pages_audited}
              </p>
              <p className="text-xs text-on-surface-variant">
                {isAr ? "صفحات تم تحليلها" : "pages analyzed"}
              </p>
            </div>

            {/* Word count */}
            <div className="rounded-2xl bg-surface-container-lowest p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <BarChart3 className="h-5 w-5 text-secondary" />
              </div>
              <p className="mt-3 font-headline text-3xl font-bold text-on-surface">
                {result.summary.total_words.toLocaleString()}
              </p>
              <p className="text-xs text-on-surface-variant">
                {isAr ? "كلمة عبر الموقع" : "total words"}
              </p>
            </div>

            {/* Site files status */}
            <div className="rounded-2xl bg-surface-container-lowest p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <ShieldCheck className="h-5 w-5 text-tertiary" />
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  {result.site_files.robots_txt_found ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                  )}
                  <span className="text-on-surface">robots.txt</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {result.site_files.sitemap_xml_found ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                  )}
                  <span className="text-on-surface">sitemap.xml</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {result.url.startsWith("https://") ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                  )}
                  <span className="text-on-surface">HTTPS</span>
                </div>
              </div>
            </div>
          </div>

          {/* AI Recommendations — the hero */}
          {result.recommendations.length > 0 && (
            <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-soft">
              <div className="mb-5 flex items-center gap-2">
                <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-xl shadow-soft">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h2 className="font-headline text-lg font-bold text-on-surface">
                    {isAr ? "توصيات دقيقة من الذكاء الاصطناعي" : "AI-powered recommendations"}
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    {isAr
                      ? "محددة ومبنية على محتوى موقعك الفعلي — مرتبة حسب الأولوية"
                      : "Specific, content-aware, ordered by priority"}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {result.recommendations.map((r) => {
                  const prio = PRIORITY_STYLE[r.priority] || PRIORITY_STYLE.medium;
                  const cat = CATEGORY_STYLE[r.category] || { color: "text-on-surface-variant", label_ar: r.category };
                  return (
                    <div
                      key={r.id}
                      className="rounded-xl border-2 border-transparent bg-surface-container-low p-4 transition-all hover:border-primary/30"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span
                          className={clsx(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold",
                            prio.bg,
                            prio.text
                          )}
                        >
                          {isAr ? prio.label : r.priority}
                        </span>
                        <span className={clsx("text-[10px] font-bold uppercase tracking-widest", cat.color)}>
                          {isAr ? cat.label_ar : r.category}
                        </span>
                        {r.expected_impact && (
                          <span className="ms-auto flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                            <TrendingUp className="h-3 w-3" />
                            {r.expected_impact}
                          </span>
                        )}
                      </div>
                      <h3 className="font-headline text-sm font-bold text-on-surface">{r.title}</h3>
                      {r.why && (
                        <p className="mt-1.5 text-xs leading-relaxed text-on-surface-variant">
                          {r.why}
                        </p>
                      )}
                      {r.how && (
                        <div className="mt-2 rounded-lg bg-surface-container-lowest p-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                            {isAr ? "كيف تنفذها" : "How"}
                          </p>
                          <p className="mt-1 text-xs text-on-surface">{r.how}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Site-level issues */}
          {result.site_issues.length > 0 && (
            <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-soft">
              <div className="mb-4 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-rose-600" />
                <h2 className="font-headline text-base font-bold text-on-surface">
                  {isAr ? "مشاكل على مستوى الموقع" : "Site-level issues"}
                </h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {result.site_issues.map((is, i) => (
                  <div key={i} className="rounded-xl bg-rose-50 p-4">
                    <p className="font-headline text-sm font-bold text-rose-800">
                      {isAr ? is.label_ar : is.label_en}
                    </p>
                    <p className="mt-1 text-xs text-rose-700">
                      {isAr ? is.fix_ar : is.fix_en}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-page drilldown */}
          {result.pages.length > 0 && (
            <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-soft">
              <div className="mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="font-headline text-base font-bold text-on-surface">
                  {isAr ? "تفاصيل كل صفحة" : "Per-page details"}
                </h2>
              </div>

              {/* Page tabs */}
              <div className="mb-4 flex flex-wrap gap-2 overflow-x-auto">
                {result.pages.map((p, i) => (
                  <button
                    key={p.url}
                    type="button"
                    onClick={() => setActivePageIdx(i)}
                    className={clsx(
                      "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
                      i === activePageIdx
                        ? "brand-gradient-bg text-white shadow-soft"
                        : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                    )}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: scoreColor(p.score) }}
                    />
                    <span className="max-w-[200px] truncate">
                      {new URL(p.url).pathname || "/"}
                    </span>
                    <span className="text-[10px] opacity-70">{p.score}</span>
                  </button>
                ))}
              </div>

              {currentPage && (
                <div className="space-y-3">
                  <a
                    href={currentPage.url}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    {currentPage.url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-surface-container-low p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                        {isAr ? "العنوان" : "Title"}
                      </p>
                      <p className="mt-1 text-sm text-on-surface">
                        {currentPage.title || <span className="text-rose-500">—</span>}
                      </p>
                    </div>
                    <div className="rounded-xl bg-surface-container-low p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                        {isAr ? "الوصف" : "Meta description"}
                      </p>
                      <p className="mt-1 text-sm text-on-surface">
                        {currentPage.meta_description || <span className="text-rose-500">—</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs text-on-surface-variant">
                    <span>
                      {isAr ? "كلمات" : "Words"}: <strong className="text-on-surface">{currentPage.word_count}</strong>
                    </span>
                    <span>
                      H1: <strong className="text-on-surface">{currentPage.h1_count}</strong>
                    </span>
                    <span>
                      {isAr ? "المشاكل" : "Issues"}: <strong className="text-on-surface">{currentPage.issues.length}</strong>
                    </span>
                  </div>
                  {currentPage.issues.length > 0 && (
                    <ul className="space-y-2">
                      {currentPage.issues.slice(0, 10).map((is, i) => (
                        <li key={i} className="rounded-lg bg-surface-container-low p-3 text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className={clsx(
                                "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase",
                                is.severity === "high"
                                  ? "bg-rose-100 text-rose-700"
                                  : is.severity === "medium"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-slate-100 text-slate-700"
                              )}
                            >
                              {is.severity}
                            </span>
                            <span className="font-semibold text-on-surface">
                              {isAr ? is.label_ar : is.label_en}
                            </span>
                          </div>
                          <p className="mt-1 text-on-surface-variant">
                            {isAr ? is.fix_ar : is.fix_en}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Integrations: Google Search Console + Analytics ── */}
      <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-soft">
        <div className="mb-5 flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h2 className="font-headline text-lg font-bold text-on-surface">
            {isAr ? "ربط مع جوجل لمتابعة أداء موقعك" : "Connect Google for live traffic data"}
          </h2>
        </div>
        <p className="mb-5 max-w-2xl text-sm text-on-surface-variant">
          {isAr
            ? "اربط حساباتك لترى الزوّار الحقيقيين، الكلمات التي يبحثون بها، ومعدل التحويل — مباشرة داخل Ignify."
            : "Connect your accounts to see real visitors, the keywords they search, and conversion rates — inside Ignify."}
        </p>

        {integrations === null ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-2xl border-2 border-outline/10 bg-surface-container-low p-5">
                <div className="mb-3 flex items-center gap-3">
                  <Skeleton className="h-10 w-10" rounded="xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                </div>
                <div className="mb-4 space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-11/12" />
                  <Skeleton className="h-3 w-10/12" />
                </div>
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Search Console */}
          <div className="rounded-2xl border-2 border-primary/10 bg-primary/5 p-5">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-soft">
                <Eye className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-headline text-sm font-bold text-on-surface">Google Search Console</h3>
                <p className="text-[11px] text-on-surface-variant">
                  {isAr ? "ظهور + نقرات + كلمات البحث" : "Impressions + clicks + search queries"}
                </p>
              </div>
            </div>
            <ul className="mb-4 space-y-1.5 text-xs text-on-surface-variant">
              <li className="flex items-start gap-1.5">
                <MousePointerClick className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                {isAr ? "الكلمات التي يبحث بها الزوار ويصلون منها لموقعك" : "Keywords visitors use to find you"}
              </li>
              <li className="flex items-start gap-1.5">
                <TrendingUp className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                {isAr ? "ترتيب صفحاتك في نتائج جوجل" : "Your pages' Google ranking positions"}
              </li>
              <li className="flex items-start gap-1.5">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                {isAr ? "مشاكل الفهرسة والتغطية" : "Indexing & coverage issues"}
              </li>
            </ul>
            <IntegrationButton
              connected={!!integrations?.search_console.connected}
              oauthConfigured={!!integrations?.oauth_configured}
              siteUrl={integrations?.search_console.site_url}
              lastSync={integrations?.search_console.last_sync}
              service="search-console"
              isAr={isAr}
              onChange={refreshIntegrations}
            />
          </div>

          {/* Analytics */}
          <div className="rounded-2xl border-2 border-secondary/10 bg-secondary/5 p-5">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-soft">
                <Users className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <h3 className="font-headline text-sm font-bold text-on-surface">Google Analytics 4</h3>
                <p className="text-[11px] text-on-surface-variant">
                  {isAr ? "الزوار + الجلسات + التحويلات" : "Visitors + sessions + conversions"}
                </p>
              </div>
            </div>
            <ul className="mb-4 space-y-1.5 text-xs text-on-surface-variant">
              <li className="flex items-start gap-1.5">
                <Users className="mt-0.5 h-3 w-3 shrink-0 text-secondary" />
                {isAr ? "عدد الزوار اليومي والأسبوعي" : "Daily & weekly visitor counts"}
              </li>
              <li className="flex items-start gap-1.5">
                <BarChart3 className="mt-0.5 h-3 w-3 shrink-0 text-secondary" />
                {isAr ? "الصفحات الأكثر زيارة والأكثر تحويلاً" : "Top pages + top converters"}
              </li>
              <li className="flex items-start gap-1.5">
                <TrendingUp className="mt-0.5 h-3 w-3 shrink-0 text-secondary" />
                {isAr ? "مصادر الترافيك (بحث، اجتماعي، مباشر)" : "Traffic sources (search, social, direct)"}
              </li>
            </ul>
            <IntegrationButton
              connected={!!integrations?.analytics.connected}
              oauthConfigured={!!integrations?.oauth_configured}
              propertyId={integrations?.analytics.property_id}
              lastSync={integrations?.analytics.last_sync}
              service="analytics"
              isAr={isAr}
              onChange={refreshIntegrations}
            />
          </div>
        </div>
        )}

        {integrations && !integrations.oauth_configured && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {isAr
                ? "الربط مع جوجل يحتاج إعداد إضافي من المسؤول — تواصل معنا لتفعيله على حسابك."
                : "Google OAuth is not configured on this environment. Ask your admin to enable it."}
            </span>
          </div>
        )}

        {/* Search Console data panel */}
        {integrations?.search_console.connected && integrations.search_console.data && (
          <div className="mt-5 rounded-2xl bg-surface-container-low p-5">
            <div className="mb-3 flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <h4 className="font-headline text-sm font-bold text-on-surface">
                {isAr
                  ? `أعلى الكلمات خلال آخر ${integrations.search_console.data.period_days} يوم`
                  : `Top queries (last ${integrations.search_console.data.period_days} days)`}
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-start text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    <th className="pb-2 ps-2 text-start">{isAr ? "الكلمة" : "Query"}</th>
                    <th className="pb-2 text-end">{isAr ? "نقرات" : "Clicks"}</th>
                    <th className="pb-2 text-end">{isAr ? "ظهور" : "Impressions"}</th>
                    <th className="pb-2 text-end">CTR</th>
                    <th className="pb-2 pe-2 text-end">{isAr ? "الترتيب" : "Pos"}</th>
                  </tr>
                </thead>
                <tbody>
                  {(integrations.search_console.data.top_queries || []).slice(0, 10).map((r, i) => (
                    <tr key={i} className="border-t border-outline/10">
                      <td className="py-1.5 ps-2 font-medium text-on-surface">{r.query}</td>
                      <td className="text-end">{r.clicks}</td>
                      <td className="text-end text-on-surface-variant">{r.impressions}</td>
                      <td className="text-end">{r.ctr}%</td>
                      <td className="pe-2 text-end">{r.position}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Analytics data panel */}
        {integrations?.analytics.connected && integrations.analytics.data && (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-surface-container-low p-5">
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-secondary" />
                <h4 className="font-headline text-sm font-bold text-on-surface">
                  {isAr ? "أكثر الصفحات زيارة" : "Top pages"}
                </h4>
              </div>
              <ul className="space-y-1.5 text-xs">
                {(integrations.analytics.data.top_pages || []).slice(0, 8).map((r, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 border-t border-outline/10 pt-1.5"
                  >
                    <span className="truncate font-medium text-on-surface">{r.page}</span>
                    <span className="text-on-surface-variant">
                      {r.screenPageViews?.toLocaleString()}{" "}
                      {isAr ? "مشاهدة" : "views"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-surface-container-low p-5">
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <h4 className="font-headline text-sm font-bold text-on-surface">
                  {isAr ? "مصادر الزوار" : "Traffic sources"}
                </h4>
              </div>
              <ul className="space-y-1.5 text-xs">
                {(integrations.analytics.data.traffic_sources || []).map((r, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 border-t border-outline/10 pt-1.5"
                  >
                    <span className="font-medium text-on-surface">{r.channel}</span>
                    <span className="text-on-surface-variant">
                      {r.sessions?.toLocaleString()} {isAr ? "جلسة" : "sessions"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Integration button ──────────────────────────────────────────────────

function IntegrationButton({
  connected,
  oauthConfigured,
  service,
  siteUrl,
  propertyId,
  lastSync,
  isAr,
  onChange,
}: {
  connected: boolean;
  oauthConfigured: boolean;
  service: "search-console" | "analytics";
  siteUrl?: string | null;
  propertyId?: string | null;
  lastSync?: string | null;
  isAr: boolean;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ sites?: Site[]; properties?: Property[] } | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  const needsPick =
    connected &&
    ((service === "search-console" && !siteUrl) || (service === "analytics" && !propertyId));

  async function startOAuth() {
    setBusy("connect");
    try {
      const res = await api.get<{ url: string }>(`/api/v1/seo/integrations/${service}/connect`);
      if (res?.url) window.location.href = res.url;
    } catch {
      toast.error(isAr ? "فشل بدء الربط" : "Failed to start OAuth");
    } finally {
      setBusy(null);
    }
  }

  async function loadPicker() {
    setBusy("pick");
    try {
      if (service === "search-console") {
        const r = await api.get<{ sites: Site[] }>("/api/v1/seo/integrations/search-console/sites");
        setPicker({ sites: r.sites || [] });
      } else {
        const r = await api.get<{ properties: Property[] }>(
          "/api/v1/seo/integrations/analytics/properties"
        );
        setPicker({ properties: r.properties || [] });
      }
    } catch {
      toast.error(isAr ? "تعذّر جلب القائمة" : "Failed to load list");
    } finally {
      setBusy(null);
    }
  }

  async function pick(idOrUrl: string) {
    setBusy("save-pick");
    try {
      if (service === "search-console") {
        await api.post("/api/v1/seo/integrations/search-console/site", { site_url: idOrUrl });
      } else {
        await api.post("/api/v1/seo/integrations/analytics/property", { property_id: idOrUrl });
      }
      setPicker(null);
      onChange();
    } finally {
      setBusy(null);
    }
  }

  async function sync() {
    setBusy("sync");
    try {
      await api.post(`/api/v1/seo/integrations/${service}/sync`);
      onChange();
    } catch (e) {
      toast.error((e as { data?: { detail?: string } })?.data?.detail || (isAr ? "فشل التحديث" : "Sync failed"));
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    const ok = await confirm({
      title: isAr ? "تأكيد" : "Confirm",
      description: isAr ? "قطع الاتصال؟" : "Disconnect?",
      kind: "danger",
      confirmLabel: isAr ? "فصل" : "Disconnect",
      cancelLabel: isAr ? "إلغاء" : "Cancel",
    });
    if (!ok) return;
    setBusy("disconnect");
    try {
      await api.delete(`/api/v1/seo/integrations/${service}`);
      onChange();
    } finally {
      setBusy(null);
    }
  }

  if (connected) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-xl bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {isAr ? "متصل" : "Connected"}
          {siteUrl && <span className="ms-1 font-normal truncate">· {siteUrl}</span>}
          {propertyId && <span className="ms-1 font-normal">· {propertyId}</span>}
        </div>

        {needsPick && !picker && (
          <button
            type="button"
            onClick={loadPicker}
            disabled={busy !== null}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
          >
            {busy === "pick" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {service === "search-console"
              ? isAr
                ? "اختر الموقع"
                : "Pick site"
              : isAr
              ? "اختر الخاصية"
              : "Pick property"}
          </button>
        )}

        {picker && (
          <div className="rounded-xl bg-white p-2 text-xs ring-1 ring-outline/20">
            {picker.sites && picker.sites.length === 0 && (
              <p className="p-2 text-on-surface-variant">
                {isAr ? "لا توجد مواقع مرتبطة في حساب Search Console." : "No sites in your Search Console."}
              </p>
            )}
            {picker.sites?.map((s) => (
              <button
                key={s.siteUrl}
                type="button"
                onClick={() => pick(s.siteUrl)}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-start hover:bg-surface-container-low"
              >
                <span className="truncate">{s.siteUrl}</span>
                <span className="text-[10px] text-on-surface-variant">{s.permissionLevel}</span>
              </button>
            ))}
            {picker.properties && picker.properties.length === 0 && (
              <p className="p-2 text-on-surface-variant">
                {isAr ? "لا توجد خصائص GA4 في حسابك." : "No GA4 properties in your account."}
              </p>
            )}
            {picker.properties?.map((p) => (
              <button
                key={p.property_id}
                type="button"
                onClick={() => pick(p.property_id)}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-start hover:bg-surface-container-low"
              >
                <span className="truncate">{p.display_name || p.property_id}</span>
                <span className="text-[10px] text-on-surface-variant">{p.account}</span>
              </button>
            ))}
          </div>
        )}

        {!needsPick && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={sync}
              disabled={busy !== null}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-60"
            >
              {busy === "sync" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              {isAr ? "تحديث" : "Sync now"}
            </button>
            <button
              type="button"
              onClick={disconnect}
              disabled={busy !== null}
              className="rounded-xl bg-surface-container-low px-3 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
            >
              {isAr ? "قطع الاتصال" : "Disconnect"}
            </button>
          </div>
        )}

        {lastSync && (
          <p className="text-[10px] text-on-surface-variant">
            {isAr ? "آخر تحديث:" : "Last sync:"} {new Date(lastSync).toLocaleString()}
          </p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={!oauthConfigured || busy !== null}
      onClick={startOAuth}
      className={clsx(
        "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
        oauthConfigured
          ? "brand-gradient-bg text-white hover:brightness-105"
          : "cursor-not-allowed bg-surface-container-high text-on-surface-variant"
      )}
    >
      {busy === "connect" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Zap className="h-3.5 w-3.5" />
      )}
      {isAr ? "ربط الحساب" : "Connect"}
    </button>
  );
}
