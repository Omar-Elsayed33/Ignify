"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import Skeleton from "@/components/Skeleton";
import { useToast } from "@/components/Toaster";
import { api, ApiError } from "@/lib/api";
import { Copy, Gift, MessageCircle, Twitter, Link2, Users, Clock, CheckCircle2 } from "lucide-react";

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
