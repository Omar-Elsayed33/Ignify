"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import DashboardHeader from "@/components/DashboardHeader";
import StatCard from "@/components/StatCard";
import { SkeletonCard } from "@/components/Skeleton";
import WelcomeTour from "@/components/WelcomeTour";
import { api } from "@/lib/api";
import {
  Users,
  Target,
  FileText,
  Coins,
  PenLine,
  Rocket,
  UserPlus,
  BarChart3,
  Clock,
  Share2,
  Megaphone,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Calendar,
  Download,
  Bell,
  Plug,
  UserCircle,
  Mail,
  X,
  MessageCircle,
  Instagram,
  Globe,
  MessageSquare,
  Inbox as InboxIcon,
  LucideIcon,
} from "lucide-react";
import { useAuthStore } from "@/store/auth.store";

interface OverviewData {
  total_leads: number;
  total_campaigns: number;
  total_channels: number;
  total_content_posts: number;
  total_social_posts: number;
  total_ad_campaigns: number;
  credit_balance: number;
  posts_published_week?: number;
  avg_engagement_week?: number;
  top_post_title_week?: string;
}

interface WeeklyDigest {
  posts_published_week?: number;
  avg_engagement_week?: number;
  top_post_title_week?: string;
}

interface Report {
  id: string;
  name: string;
  report_type: string;
  created_at: string;
}

interface PlanListEntry {
  id: string;
  status?: string;
}

interface ScheduledAccount {
  id: string;
  platform: string;
  page_name?: string;
  expires_at?: string | null;
}

interface ScheduledPostEntry {
  id: string;
  status?: string;
  scheduled_at?: string | null;
  publish_mode?: string;
}

interface ActionItem {
  key: string;
  ar: string;
  en: string;
  Icon: LucideIcon;
  href?: string;
  onClick?: () => void | Promise<void>;
}

interface InboxConversation {
  id: string;
  channel_id: string;
  channel_type?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
  updated_at: string;
}

function SkeletonStatCard() {
  return (
    <div className="animate-pulse rounded-2xl bg-surface-container-lowest p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <div className="h-11 w-11 rounded-xl bg-surface-container-high" />
        <div className="h-5 w-14 rounded-lg bg-surface-container-high" />
      </div>
      <div className="mt-5 h-3 w-20 rounded bg-surface-container-high" />
      <div className="mt-2 h-8 w-24 rounded bg-surface-container-high" />
    </div>
  );
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const isAr = locale === "ar";

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [plansCount, setPlansCount] = useState<number | null>(null);
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftPlansCount, setDraftPlansCount] = useState<number>(0);
  const [disconnectedAccounts, setDisconnectedAccounts] = useState<number>(0);
  const [pendingManualPosts, setPendingManualPosts] = useState<number>(0);
  const [resendingVerify, setResendingVerify] = useState<boolean>(false);
  const [verifyResent, setVerifyResent] = useState<boolean>(false);
  const [profileIncomplete, setProfileIncomplete] = useState<boolean>(false);
  const [incompleteSteps, setIncompleteSteps] = useState<string[]>([]);
  const [onboardingPillDismissed, setOnboardingPillDismissed] = useState<boolean>(true);
  const [inboxConversations, setInboxConversations] = useState<InboxConversation[] | null>(null);
  const [inboxLoading, setInboxLoading] = useState<boolean>(true);
  const user = useAuthStore((state) => state.user);
  const tenant = useAuthStore((state) => state.tenant);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const [overviewData, reportsData] = await Promise.all([
          api.get<OverviewData>("/api/v1/analytics/overview"),
          api.get<Report[]>("/api/v1/analytics/reports?limit=5"),
        ]);
        setOverview(overviewData);
        setReports(reportsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("loadFailed"));
      } finally {
        setLoading(false);
      }

      try {
        const plansData = await api.get<{ plans: Array<unknown> } | Array<unknown>>(
          "/api/v1/plans?limit=1"
        );
        const items = Array.isArray(plansData)
          ? plansData
          : Array.isArray(plansData?.plans)
            ? plansData.plans
            : [];
        setPlansCount(items.length);
      } catch {
        // Non-fatal: leave plansCount null so the CTA won't render on failure.
      }

      try {
        const digestData = await api.get<WeeklyDigest>("/api/v1/analytics/weekly-digest");
        setDigest(digestData);
      } catch {
        // Non-fatal: UI will fall back to overview-derived values or placeholders.
      }

      // Action-needed signals — each fetch is best-effort and silent on failure.
      try {
        const draftsData = await api.get<PlanListEntry[] | { plans: PlanListEntry[] }>(
          "/api/v1/plans?limit=20"
        );
        const items = Array.isArray(draftsData)
          ? draftsData
          : Array.isArray(draftsData?.plans)
            ? draftsData.plans
            : [];
        setDraftPlansCount(items.filter((p) => p?.status === "draft").length);
      } catch {
        // ignore
      }

      try {
        const accounts = await api.get<ScheduledAccount[]>(
          "/api/v1/social-scheduler/accounts"
        );
        const nowMs = Date.now();
        const disconnected = (accounts ?? []).filter((a) => {
          if (!a?.expires_at) return false;
          const ts = new Date(a.expires_at).getTime();
          return Number.isFinite(ts) && ts < nowMs;
        }).length;
        setDisconnectedAccounts(disconnected);
      } catch {
        // ignore
      }

      try {
        const profile = await api.get<Record<string, unknown>>(
          "/api/v1/tenant-settings/business-profile"
        );
        const hasName = typeof profile?.name === "string" && (profile.name as string).trim().length > 0;
        const hasIndustry =
          typeof profile?.industry === "string" && (profile.industry as string).trim().length > 0;
        const hasDescription =
          typeof profile?.description === "string" &&
          (profile.description as string).trim().length > 0;
        setProfileIncomplete(!(hasName && hasIndustry && hasDescription));
      } catch {
        // ignore
      }

      try {
        const scheduled = await api.get<ScheduledPostEntry[]>(
          "/api/v1/social-scheduler/scheduled"
        );
        const nowMs = Date.now();
        const pending = (scheduled ?? []).filter((p) => {
          if (p?.publish_mode !== "manual") return false;
          if (p?.status === "published") return false;
          if (!p?.scheduled_at) return false;
          const ts = new Date(p.scheduled_at).getTime();
          return Number.isFinite(ts) && ts <= nowMs;
        }).length;
        setPendingManualPosts(pending);
      } catch {
        // ignore
      }

      // Priority inbox messages — endpoint doesn't support priority filter; take 5 most recent.
      try {
        const convs = await api.get<InboxConversation[]>(
          "/api/v1/inbox/conversations?limit=5"
        );
        setInboxConversations(Array.isArray(convs) ? convs.slice(0, 5) : []);
      } catch {
        setInboxConversations([]);
      } finally {
        setInboxLoading(false);
      }

      // Onboarding skip-ahead detection: completed=true but some step still blank.
      try {
        const status = await api.get<{
          completed?: boolean;
          business_profile?: Record<string, unknown> | null;
          brand_voice?: Record<string, unknown> | null;
          channels?: string[];
        }>("/api/v1/onboarding/status");
        if (status?.completed) {
          const missing: string[] = [];
          if (!status.business_profile) missing.push("business");
          if (!status.brand_voice) missing.push("brand");
          if (!Array.isArray(status.channels) || status.channels.length === 0) {
            missing.push("channels");
          }
          setIncompleteSteps(missing);
          if (missing.length > 0 && typeof window !== "undefined") {
            const dismissed =
              window.localStorage.getItem("ignify_onboarding_pill_dismissed") === "true";
            setOnboardingPillDismissed(dismissed);
          }
        }
      } catch {
        // ignore
      }
    }
    fetchData();
  }, []);

  function dismissOnboardingPill() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("ignify_onboarding_pill_dismissed", "true");
    }
    setOnboardingPillDismissed(true);
  }

  async function handleResendVerification() {
    if (resendingVerify) return;
    setResendingVerify(true);
    try {
      await api.post("/api/v1/auth/resend-verification", {});
      setVerifyResent(true);
    } catch {
      // silently ignore — user can retry
    } finally {
      setResendingVerify(false);
    }
  }

  // Resolve digest metrics: prefer dedicated endpoint, fall back to overview, else undefined.
  const postsPublishedWeek =
    digest?.posts_published_week ?? overview?.posts_published_week ?? null;
  const avgEngagementWeek =
    digest?.avg_engagement_week ?? overview?.avg_engagement_week ?? null;
  const topPostTitleWeek =
    digest?.top_post_title_week ?? overview?.top_post_title_week ?? null;

  const hoursSaved =
    typeof postsPublishedWeek === "number" && Number.isFinite(postsPublishedWeek)
      ? postsPublishedWeek * 0.5
      : null;
  const hoursSavedDisplay =
    hoursSaved === null
      ? null
      : Number.isInteger(hoursSaved)
        ? hoursSaved.toString()
        : hoursSaved.toFixed(1);

  const collectingText = isAr ? "قيد التجميع" : "Collecting data";

  const actionItems: ActionItem[] = [];

  if (draftPlansCount > 0) {
    actionItems.push({
      key: "draft-plans",
      Icon: FileText,
      ar: "خطتك التسويقية تنتظر المراجعة",
      en: "Your plan is waiting for review",
      href: "/plans",
    });
  }

  if (disconnectedAccounts > 0) {
    actionItems.push({
      key: "disconnected-accounts",
      Icon: Plug,
      ar: "حساب منصة غير متصل",
      en: "A social account is disconnected",
      href: "/scheduler/accounts",
    });
  }

  if (profileIncomplete && tenant) {
    actionItems.push({
      key: "profile",
      Icon: UserCircle,
      ar: "أكمل ملفك التعريفي",
      en: "Complete your profile",
      href: "/settings/business-profile",
    });
  }

  if (pendingManualPosts > 0) {
    actionItems.push({
      key: "manual-posts",
      Icon: Calendar,
      ar: "منشور جاهز للنشر اليدوي",
      en: "A post is ready to be marked published",
      href: "/scheduler",
    });
  }

  if (user && user.email_verified === false) {
    actionItems.push({
      key: "email-verify",
      Icon: Mail,
      ar: verifyResent ? "أُرسل رابط التحقق" : "تحقّق من بريدك الإلكتروني",
      en: verifyResent ? "Verification email sent" : "Verify your email",
      onClick: verifyResent ? undefined : handleResendVerification,
    });
  }

  function channelIconFor(type?: string | null): LucideIcon {
    const t = (type ?? "").toLowerCase();
    if (t.includes("whatsapp")) return MessageCircle;
    if (t.includes("instagram")) return Instagram;
    if (t.includes("messenger") || t.includes("facebook")) return MessageSquare;
    if (t.includes("web")) return Globe;
    return InboxIcon;
  }

  function timeAgo(iso?: string | null): string {
    if (!iso) return "";
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return "";
    const diffMs = Date.now() - then;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return isAr ? "الآن" : "now";
    if (mins < 60) return isAr ? `منذ ${mins} د` : `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return isAr ? `منذ ${hours} س` : `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return isAr ? `منذ ${days} ي` : `${days}d ago`;
  }

  const showInboxWidget =
    inboxLoading || (inboxConversations && inboxConversations.length > 0);

  const quickActions = [
    { label: t("createContent"), icon: PenLine, tint: "bg-primary-fixed text-primary" },
    { label: t("launchCampaign"), icon: Rocket, tint: "bg-secondary-fixed text-secondary" },
    { label: t("addLead"), icon: UserPlus, tint: "bg-tertiary-fixed text-on-tertiary-fixed-variant" },
    { label: t("generateReport"), icon: BarChart3, tint: "bg-primary-fixed text-primary" },
  ];

  return (
    <div>
      <WelcomeTour />
      <DashboardHeader title={t("title")} />

      <div className="px-4 pb-12 pt-2 md:px-8">
        <div className="mx-auto max-w-7xl space-y-10">
          {error && (
            <div className="flex items-center gap-3 rounded-2xl bg-error-container px-5 py-3 text-sm text-on-error-container">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {!loading && plansCount === 0 && (
            <div className="relative overflow-hidden rounded-3xl brand-gradient p-8 text-white shadow-soft">
              <div className="max-w-xl">
                <h2 className="text-2xl font-bold">
                  {isAr ? "ابدأ أول خطة تسويقية" : "Start your first marketing plan"}
                </h2>
                <p className="mt-2 text-sm text-white/85">
                  {isAr
                    ? "سيحلل Ignify عملك ويبني خطة تسويق كاملة خلال دقائق."
                    : "Ignify will analyze your business and build a complete marketing plan in minutes."}
                </p>
                <Link
                  href="/plans/new"
                  className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white/15 px-5 py-2.5 text-sm font-semibold backdrop-blur hover:bg-white/25"
                >
                  <Sparkles className="h-4 w-4" />
                  {isAr ? "أنشئ خطة الآن" : "Create a plan now"}
                </Link>
              </div>
            </div>
          )}

          {/* Onboarding skip-ahead pill */}
          {incompleteSteps.length > 0 && !onboardingPillDismissed && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {isAr ? "أكمل ملفك التعريفي" : "Complete your profile"}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  {incompleteSteps.map((step) => {
                    const labels: Record<string, { ar: string; en: string; href: string }> = {
                      business: {
                        ar: "ملف العمل",
                        en: "Business profile",
                        href: "/onboarding/business",
                      },
                      brand: {
                        ar: "الهوية البصرية",
                        en: "Brand identity",
                        href: "/onboarding/brand",
                      },
                      channels: {
                        ar: "القنوات",
                        en: "Channels",
                        href: "/onboarding/channels",
                      },
                    };
                    const meta = labels[step];
                    if (!meta) return null;
                    return (
                      <Link
                        key={step}
                        href={meta.href}
                        className="font-semibold underline-offset-2 hover:underline"
                      >
                        {isAr ? meta.ar : meta.en}
                      </Link>
                    );
                  })}
                </div>
              </div>
              <button
                type="button"
                onClick={dismissOnboardingPill}
                aria-label={isAr ? "إخفاء" : "Dismiss"}
                className="shrink-0 rounded-lg p-1 text-amber-700 transition-colors hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Weekly digest + impact */}
          <div className="grid gap-4 lg:grid-cols-3">
            {loading ? (
              <>
                <SkeletonCard className="lg:col-span-2" />
                <SkeletonCard />
              </>
            ) : (
              <>
                <div className="rounded-3xl border-t-4 border-primary bg-surface-container-lowest p-6 shadow-soft lg:col-span-2">
                  <div className="mb-5 flex items-center gap-2">
                    <div className="rounded-xl bg-primary-fixed p-2 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <h3 className="font-headline text-lg font-bold text-on-surface">
                      {isAr ? "ملخص هذا الأسبوع" : "This week"}
                    </h3>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs font-medium text-on-surface-variant">
                        {isAr ? "منشورات نُشرت" : "Posts published"}
                      </p>
                      <p className="mt-1 font-headline text-2xl font-bold text-on-surface">
                        {postsPublishedWeek !== null
                          ? postsPublishedWeek.toLocaleString()
                          : collectingText}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-on-surface-variant">
                        {isAr ? "متوسط التفاعل" : "Avg. engagement"}
                      </p>
                      <p className="mt-1 font-headline text-2xl font-bold text-on-surface">
                        {avgEngagementWeek !== null
                          ? `${avgEngagementWeek.toLocaleString(undefined, {
                              maximumFractionDigits: 1,
                            })}%`
                          : collectingText}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-on-surface-variant">
                        {isAr ? "أفضل منشور" : "Top post"}
                      </p>
                      <p
                        className="mt-1 truncate font-headline text-lg font-bold text-on-surface"
                        title={topPostTitleWeek ?? undefined}
                      >
                        {topPostTitleWeek && topPostTitleWeek.trim().length > 0
                          ? topPostTitleWeek
                          : collectingText}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl brand-gradient p-6 text-white shadow-soft">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="rounded-xl bg-white/15 p-2 backdrop-blur">
                      <Clock className="h-4 w-4" />
                    </div>
                    <h3 className="font-headline text-lg font-bold">
                      {isAr ? "قيمتك هذا الأسبوع" : "Your impact this week"}
                    </h3>
                  </div>
                  <p className="font-headline text-4xl font-bold">
                    {hoursSavedDisplay !== null
                      ? `${hoursSavedDisplay} ${isAr ? "ساعة" : "hrs"}`
                      : collectingText}
                  </p>
                  <p className="mt-2 text-sm text-white/85">
                    {isAr
                      ? "لو كتبت هذه المنشورات يدوياً"
                      : "if you'd written these manually"}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Action needed */}
          {actionItems.length > 0 && (
            <div className="rounded-3xl bg-surface-container-lowest p-6 shadow-soft">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold text-on-surface">
                  {isAr ? "إجراءات مطلوبة" : "Action needed"}
                </h3>
                <span className="rounded-full bg-primary-fixed px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {actionItems.length}
                </span>
              </div>
              <ul className="mt-4 space-y-2">
                {actionItems.map((item) => (
                  <li
                    key={item.key}
                    className="flex items-start gap-3 rounded-2xl bg-surface-container p-3 transition-colors hover:bg-surface-container-high"
                  >
                    <item.Icon className="mt-0.5 h-4 w-4 shrink-0 text-on-surface-variant" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-on-surface">{isAr ? item.ar : item.en}</p>
                    </div>
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="shrink-0 text-xs font-semibold text-primary hover:underline"
                      >
                        {isAr ? "عرض" : "View"}
                      </Link>
                    ) : item.onClick ? (
                      <button
                        type="button"
                        onClick={() => void item.onClick?.()}
                        disabled={resendingVerify}
                        className="shrink-0 text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                      >
                        {resendingVerify
                          ? isAr
                            ? "جارٍ الإرسال..."
                            : "Sending..."
                          : isAr
                            ? "إعادة إرسال"
                            : "Resend"}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Priority inbox messages */}
          {showInboxWidget && (
            <div className="rounded-3xl bg-surface-container-lowest p-6 shadow-soft">
              <div className="mb-4 flex items-center gap-2">
                <InboxIcon className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold text-on-surface">
                  {isAr ? "رسائل اليوم ذات الأولوية" : "Today's priority messages"}
                </h3>
              </div>
              {inboxLoading ? (
                <div className="space-y-2">
                  <SkeletonCard />
                  <SkeletonCard />
                </div>
              ) : (
                <ul className="space-y-2">
                  {(inboxConversations ?? []).map((conv) => {
                    const ChannelIcon = channelIconFor(conv.channel_type);
                    const name =
                      (conv.customer_name && conv.customer_name.trim()) ||
                      conv.customer_phone ||
                      (isAr ? "عميل" : "Customer");
                    return (
                      <li
                        key={conv.id}
                        className="flex items-center gap-3 rounded-2xl bg-surface-container p-3 transition-colors hover:bg-surface-container-high"
                      >
                        <div className="rounded-xl bg-primary-fixed p-2 text-primary">
                          <ChannelIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-on-surface">
                              {name}
                            </p>
                            <span className="shrink-0 text-[10px] text-on-surface-variant/70">
                              {timeAgo(conv.last_message_at ?? conv.updated_at)}
                            </span>
                          </div>
                          <p className="truncate text-xs text-on-surface-variant">
                            {conv.last_message ?? ""}
                          </p>
                        </div>
                        <Link
                          href={`/inbox?conversation_id=${conv.id}`}
                          className="shrink-0 rounded-xl bg-primary-fixed px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary-fixed/80"
                        >
                          {isAr ? "رد" : "Reply"}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Hero */}
          <section
            data-tour="dashboard-home"
            className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end"
          >
            <div className="space-y-3">
              <span className="insight-chip">
                <Sparkles className="h-3 w-3" />
                {t("welcome")}
              </span>
              <h2 className="font-headline text-3xl font-bold tracking-tight text-on-surface md:text-4xl lg:text-5xl">
                {t("title")}
              </h2>
              <p className="max-w-lg text-sm font-medium leading-relaxed text-on-surface-variant">
                {t("heroDesc") ?? "لوحة تحكم التسويق جاهزة. تابع أداء حملاتك ومنصاتك من مكان واحد."}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="flex items-center gap-2 rounded-2xl bg-surface-container-highest px-5 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-variant">
                <Calendar className="h-4 w-4" />
                {t("last30Days") ?? "Last 30 Days"}
              </button>
              <button className="brand-gradient flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold text-white shadow-soft transition-transform hover:scale-[1.02]">
                <Download className="h-4 w-4" />
                {t("exportReport") ?? "Export Report"}
              </button>
            </div>
          </section>

          {/* KPI Grid */}
          <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {loading ? (
              <>
                <SkeletonStatCard />
                <SkeletonStatCard />
                <SkeletonStatCard />
                <SkeletonStatCard />
              </>
            ) : (
              <>
                <StatCard
                  icon={Users}
                  label={t("totalLeads")}
                  value={overview?.total_leads.toLocaleString() ?? "0"}
                  change={14.2}
                  iconColor="text-primary"
                  iconBg="bg-primary-fixed"
                />
                <StatCard
                  icon={Target}
                  label={t("activeCampaigns")}
                  value={overview?.total_campaigns.toLocaleString() ?? "0"}
                  change={5.4}
                  iconColor="text-secondary"
                  iconBg="bg-secondary-fixed"
                />
                <StatCard
                  icon={FileText}
                  label={t("contentPublished")}
                  value={overview?.total_content_posts.toLocaleString() ?? "0"}
                  change={22}
                  iconColor="text-on-tertiary-fixed-variant"
                  iconBg="bg-tertiary-fixed"
                />
                <StatCard
                  icon={Coins}
                  label={t("creditBalance")}
                  value={overview?.credit_balance.toLocaleString() ?? "0"}
                  iconColor="text-primary"
                  iconBg="bg-primary-fixed"
                />
              </>
            )}
          </section>

          {/* Main grid: focus + insights */}
          <section className="grid gap-8 lg:grid-cols-3">
            {/* Left 2/3 — Platform Overview */}
            <div className="space-y-8 lg:col-span-2">
              <div className="rounded-2xl bg-surface-container-lowest p-8 shadow-soft ghost-border">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-headline text-xl font-bold text-on-surface">
                      {t("platformOverview")}
                    </h3>
                    <p className="text-sm text-on-surface-variant">
                      Your marketing surface at a glance
                    </p>
                  </div>
                </div>

                {loading ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse rounded-2xl bg-surface-container-low p-5">
                        <div className="h-9 w-9 rounded-lg bg-surface-container-high" />
                        <div className="mt-3 h-7 w-14 rounded bg-surface-container-high" />
                        <div className="mt-1 h-3 w-20 rounded bg-surface-container-high" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl bg-surface-container-low p-5">
                      <div className="w-fit rounded-lg bg-secondary-fixed p-2.5">
                        <Share2 className="h-5 w-5 text-secondary" />
                      </div>
                      <p className="mt-3 font-headline text-2xl font-bold text-on-surface">
                        {overview?.total_social_posts.toLocaleString() ?? "0"}
                      </p>
                      <p className="text-sm text-on-surface-variant">{t("socialPosts")}</p>
                    </div>
                    <div className="rounded-2xl bg-surface-container-low p-5">
                      <div className="w-fit rounded-lg bg-primary-fixed p-2.5">
                        <Megaphone className="h-5 w-5 text-primary" />
                      </div>
                      <p className="mt-3 font-headline text-2xl font-bold text-on-surface">
                        {overview?.total_ad_campaigns.toLocaleString() ?? "0"}
                      </p>
                      <p className="text-sm text-on-surface-variant">{t("adCampaigns")}</p>
                    </div>
                    <div className="rounded-2xl bg-surface-container-low p-5">
                      <div className="w-fit rounded-lg bg-tertiary-fixed p-2.5">
                        <Target className="h-5 w-5 text-on-tertiary-fixed-variant" />
                      </div>
                      <p className="mt-3 font-headline text-2xl font-bold text-on-surface">
                        {overview?.total_channels.toLocaleString() ?? "0"}
                      </p>
                      <p className="text-sm text-on-surface-variant">{t("channels")}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div>
                <h3 className="mb-4 font-headline text-lg font-bold text-on-surface">
                  {t("quickActions")}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.label}
                        className="group flex items-center gap-3 rounded-2xl bg-surface-container-lowest p-4 text-start shadow-soft ghost-border transition-all hover:-translate-y-0.5"
                      >
                        <div className={`rounded-xl p-2.5 ${action.tint}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-semibold text-on-surface">
                          {action.label}
                        </span>
                        <ArrowRight className="ms-auto h-4 w-4 text-on-surface-variant/50 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right 1/3 — activity */}
            <div className="space-y-6">
              {/* Recent Activity */}
              <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-soft ghost-border">
                <h4 className="mb-5 font-headline text-lg font-bold text-on-surface">
                  {t("recentActivity")}
                </h4>
                <div className="space-y-5">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex animate-pulse items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-surface-container-high" />
                        <div className="flex-1">
                          <div className="h-4 w-3/4 rounded bg-surface-container-high" />
                          <div className="mt-1 h-3 w-1/2 rounded bg-surface-container-high" />
                        </div>
                      </div>
                    ))
                  ) : reports.length === 0 ? (
                    <p className="py-6 text-center text-sm text-on-surface-variant">
                      {t("noRecentActivity")}
                    </p>
                  ) : (
                    reports.map((report) => (
                      <div key={report.id} className="flex items-start gap-3">
                        <div className="rounded-full bg-primary-fixed p-2">
                          <BarChart3 className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-on-surface">
                            {report.name}
                          </p>
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-on-surface-variant">
                            <Clock className="h-3 w-3" />
                            {new Date(report.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
