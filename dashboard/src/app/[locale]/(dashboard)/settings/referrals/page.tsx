"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import Skeleton from "@/components/Skeleton";
import { useToast } from "@/components/Toaster";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import {
  Copy,
  Gift,
  MessageCircle,
  Twitter,
  Link2,
  Users,
  Clock,
  CheckCircle2,
  Handshake,
  Loader2,
  X,
  CheckCircle,
} from "lucide-react";

interface ReferralStats {
  code: string;
  share_url: string;
  total: number;
  pending: number;
  converted: number;
}

export default function ReferralsPage() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const toast = useToast();

  const [data, setData] = useState<ReferralStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuthStore();
  const [affiliateOpen, setAffiliateOpen] = useState(false);
  const [affiliateSubmitted, setAffiliateSubmitted] = useState(false);
  const [affiliateSubmitting, setAffiliateSubmitting] = useState(false);
  const [affFullName, setAffFullName] = useState("");
  const [affEmail, setAffEmail] = useState("");
  const [affUrl, setAffUrl] = useState("");
  const [affPitch, setAffPitch] = useState("");

  function openAffiliate() {
    setAffFullName(user?.full_name ?? "");
    setAffEmail(user?.email ?? "");
    setAffUrl("");
    setAffPitch("");
    setAffiliateSubmitted(false);
    setAffiliateOpen(true);
  }

  function closeAffiliate() {
    setAffiliateOpen(false);
    setTimeout(() => setAffiliateSubmitted(false), 200);
  }

  async function submitAffiliate(e: React.FormEvent) {
    e.preventDefault();
    if (affiliateSubmitting) return;
    setAffiliateSubmitting(true);
    const payload = {
      action: "affiliate_application",
      reason: "affiliate_application",
      note: JSON.stringify({
        full_name: affFullName,
        email: affEmail,
        url: affUrl,
        pitch: affPitch,
      }),
    };
    // Try a dedicated endpoint first, then fall back to the shared telemetry catch-all.
    try {
      try {
        await api.post("/api/v1/feedback/affiliate-application", payload);
      } catch (inner) {
        if (inner instanceof ApiError && inner.status === 404) {
          await api.post("/api/v1/feedback/cancellation-reason", payload);
        } else {
          throw inner;
        }
      }
      setAffiliateSubmitted(true);
    } catch {
      toast.error(
        isAr ? "تعذر الإرسال، حاول لاحقاً" : "Submission failed, try later"
      );
    } finally {
      setAffiliateSubmitting(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<ReferralStats>("/api/v1/referrals/me");
        setData(res);
      } catch (e) {
        setError(
          e instanceof ApiError
            ? e.message
            : isAr
              ? "فشل تحميل البيانات"
              : "Failed to load"
        );
      }
    })();
  }, [isAr]);

  const blurbAr = "انضم إلى Ignify — منصة التسويق الذكي بالذكاء الاصطناعي. استخدم رابطي:";
  const blurbEn = "Join Ignify — the AI-powered marketing platform. Use my link:";
  const blurb = isAr ? blurbAr : blurbEn;

  const copyLink = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.share_url);
      toast.success(isAr ? "تم نسخ الرابط" : "Link copied");
    } catch {
      toast.error(isAr ? "فشل النسخ" : "Copy failed");
    }
  };

  const shareWhatsApp = () => {
    if (!data) return;
    const text = `${blurb} ${data.share_url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const shareTwitter = () => {
    if (!data) return;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(blurb)}&url=${encodeURIComponent(data.share_url)}`;
    window.open(url, "_blank");
  };

  return (
    <div>
      <DashboardHeader title={isAr ? "برنامج الإحالة" : "Referral program"} />

      <div className="px-8 pb-12 pt-2">
        <div className="mx-auto max-w-4xl space-y-6">
          {error && (
            <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Hero card */}
          {!data && !error ? (
            <Skeleton className="h-72 w-full" rounded="2xl" />
          ) : data ? (
            <div className="brand-gradient relative overflow-hidden rounded-3xl p-8 text-white shadow-soft">
              <div className="absolute -end-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -bottom-16 -start-16 h-56 w-56 rounded-full bg-white/5 blur-3xl" />

              <div className="relative">
                <div className="flex items-center gap-2">
                  <Gift className="h-5 w-5" />
                  <span className="text-xs font-semibold uppercase tracking-widest opacity-90">
                    {isAr ? "رمزك الشخصي" : "Your code"}
                  </span>
                </div>
                <h2 className="mt-2 font-headline text-2xl font-bold">
                  {isAr ? "شارك Ignify واربح شهراً مجانياً" : "Share Ignify, earn a free month"}
                </h2>
                <p className="mt-1 text-sm opacity-90">
                  {isAr
                    ? "كل صديق يشترك في خطة مدفوعة يمنحك — وهو — شهراً مجانياً."
                    : "Each friend who subscribes to a paid plan earns both of you a free month."}
                </p>

                {/* Share URL + copy */}
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <div className="flex-1 truncate rounded-2xl bg-white/15 px-4 py-3 font-mono text-sm backdrop-blur-sm ring-1 ring-white/20">
                    {data.share_url}
                  </div>
                  <button
                    onClick={copyLink}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-primary shadow-soft transition-all hover:brightness-105"
                  >
                    <Copy className="h-4 w-4" />
                    {isAr ? "نسخ الرابط" : "Copy link"}
                  </button>
                </div>

                {/* Stats */}
                <div className="mt-6 grid grid-cols-3 gap-3">
                  <StatBox
                    icon={Users}
                    label={isAr ? "الإجمالي" : "Total"}
                    value={data.total}
                  />
                  <StatBox
                    icon={Clock}
                    label={isAr ? "قيد الانتظار" : "Pending"}
                    value={data.pending}
                  />
                  <StatBox
                    icon={CheckCircle2}
                    label={isAr ? "محولة" : "Converted"}
                    value={data.converted}
                  />
                </div>

                {/* Social share shortcuts */}
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={shareWhatsApp}
                    className="flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-2.5 text-sm font-semibold backdrop-blur-sm ring-1 ring-white/20 transition-colors hover:bg-white/25"
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </button>
                  <button
                    onClick={shareTwitter}
                    className="flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-2.5 text-sm font-semibold backdrop-blur-sm ring-1 ring-white/20 transition-colors hover:bg-white/25"
                  >
                    <Twitter className="h-4 w-4" />
                    {isAr ? "تويتر / X" : "X / Twitter"}
                  </button>
                  <button
                    onClick={copyLink}
                    className="flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-2.5 text-sm font-semibold backdrop-blur-sm ring-1 ring-white/20 transition-colors hover:bg-white/25"
                  >
                    <Link2 className="h-4 w-4" />
                    {isAr ? "نسخ" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Affiliate program */}
          <div className="overflow-hidden rounded-3xl border border-border bg-surface-container-lowest p-6 shadow-soft">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Handshake className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-headline text-lg font-bold text-on-surface">
                    {isAr ? "برنامج الشركاء" : "Affiliate program"}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">
                    {isAr
                      ? "احصل على عمولة متكررة 30% على إحالاتك المدفوعة لمدة سنة كاملة."
                      : "Earn 30% recurring commission on paid referrals for a full year."}
                  </p>
                </div>
              </div>
              <button
                onClick={openAffiliate}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-soft transition-all hover:bg-primary-dark"
              >
                <Handshake className="h-4 w-4" />
                {isAr ? "انضم للبرنامج" : "Apply to program"}
              </button>
            </div>
          </div>

          {/* How it works */}
          <div className="rounded-3xl bg-surface-container-lowest p-6 shadow-soft">
            <h3 className="font-headline text-lg font-bold text-on-surface">
              {isAr ? "كيف يعمل البرنامج" : "How it works"}
            </h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Step
                num={1}
                title={isAr ? "شارك رابطك" : "Share your link"}
                desc={
                  isAr
                    ? "انسخ رابطك الفريد وأرسله إلى أصدقائك عبر واتساب أو تويتر أو أي قناة تفضّلها."
                    : "Copy your unique link and send it to friends via WhatsApp, X, or any channel you prefer."
                }
              />
              <Step
                num={2}
                title={isAr ? "اشترك صديقك في خطة مدفوعة" : "Your friend subscribes to a paid plan"}
                desc={
                  isAr
                    ? "عندما يسجّل صديقك ويختار خطة مدفوعة، نحصي إحالته لصالحك تلقائياً."
                    : "When your friend signs up and picks a paid plan, the referral is automatically credited to you."
                }
              />
              <Step
                num={3}
                title={isAr ? "تحصل أنت وصديقك على شهر مجاني" : "You and your friend each get a free month"}
                desc={
                  isAr
                    ? "نضيف الشهر المجاني إلى حسابيكما فور تفعيل اشتراكه. كلما دعوت أكثر، ربحت أكثر."
                    : "We add a free month to both of your accounts the moment their subscription activates. Invite more, earn more."
                }
              />
            </div>
          </div>
        </div>
      </div>

      {affiliateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/50 p-4 backdrop-blur-sm"
          onClick={closeAffiliate}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-surface-container-lowest p-6 shadow-soft"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <Handshake className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold text-on-surface">
                  {isAr ? "برنامج الشركاء" : "Affiliate program"}
                </h3>
              </div>
              <button
                onClick={closeAffiliate}
                className="rounded-xl p-1 text-on-surface-variant hover:bg-surface-container-low"
                aria-label={isAr ? "إغلاق" : "Close"}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {affiliateSubmitted ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10 text-green-600">
                  <CheckCircle className="h-7 w-7" />
                </div>
                <p className="text-base font-semibold text-on-surface">
                  {isAr
                    ? "شكراً لتقديمك — سنتواصل خلال 48 ساعة"
                    : "Thanks — we'll reach out within 48 hours"}
                </p>
                <button
                  onClick={closeAffiliate}
                  className="mt-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low"
                >
                  {isAr ? "إغلاق" : "Close"}
                </button>
              </div>
            ) : (
              <form onSubmit={submitAffiliate} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-on-surface-variant">
                    {isAr ? "الاسم الكامل" : "Full name"}
                  </label>
                  <input
                    type="text"
                    required
                    value={affFullName}
                    onChange={(e) => setAffFullName(e.target.value)}
                    className="w-full rounded-2xl border border-border bg-surface-container-lowest p-3 text-sm text-on-surface outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-on-surface-variant">
                    {isAr ? "البريد الإلكتروني" : "Email"}
                  </label>
                  <input
                    type="email"
                    required
                    value={affEmail}
                    onChange={(e) => setAffEmail(e.target.value)}
                    className="w-full rounded-2xl border border-border bg-surface-container-lowest p-3 text-sm text-on-surface outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-on-surface-variant">
                    {isAr
                      ? "رابط موقعك أو صفحتك الاجتماعية (اختياري)"
                      : "Website / social URL (optional)"}
                  </label>
                  <input
                    type="url"
                    value={affUrl}
                    onChange={(e) => setAffUrl(e.target.value)}
                    placeholder="https://"
                    className="w-full rounded-2xl border border-border bg-surface-container-lowest p-3 text-sm text-on-surface outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-on-surface-variant">
                    {isAr
                      ? "كيف ستروّج لـ Ignify؟"
                      : "How will you promote Ignify?"}
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={affPitch}
                    onChange={(e) => setAffPitch(e.target.value)}
                    className="w-full rounded-2xl border border-border bg-surface-container-lowest p-3 text-sm text-on-surface outline-none focus:border-primary"
                    placeholder={
                      isAr
                        ? "أخبرنا عن جمهورك وطرق الترويج..."
                        : "Tell us about your audience and channels..."
                    }
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeAffiliate}
                    className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low"
                  >
                    {isAr ? "إلغاء" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    disabled={affiliateSubmitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
                  >
                    {affiliateSubmitting && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {isAr ? "إرسال الطلب" : "Submit application"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm ring-1 ring-white/20">
      <div className="flex items-center gap-1.5 text-xs opacity-90">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 font-headline text-2xl font-bold">{value}</div>
    </div>
  );
}

function Step({
  num,
  title,
  desc,
}: {
  num: number;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl bg-surface-container-low p-5">
      <div className="brand-gradient flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white shadow-soft">
        {num}
      </div>
      <h4 className="mt-3 text-sm font-bold text-on-surface">{title}</h4>
      <p className="mt-1.5 text-xs leading-relaxed text-on-surface-variant">{desc}</p>
    </div>
  );
}
