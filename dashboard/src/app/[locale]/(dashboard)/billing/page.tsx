"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import DashboardHeader from "@/components/DashboardHeader";
import { Loader2, AlertTriangle, ArrowUpRight, Settings2, X, Gift } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toaster";

// ── Types ────────────────────────────────────────────────────────────────────

interface SubscriptionStatus {
  plan_code: string;
  plan_name_en: string;
  plan_name_ar: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  provider: string | null;
}

interface UsageData {
  quota: Record<string, number>;
  used: Record<string, number>;
  remaining: Record<string, number>;
}

// ── Usage bar ────────────────────────────────────────────────────────────────

function UsageBar({
  label,
  used,
  quota,
  unlimitedLabel,
  ofLabel,
}: {
  label: string;
  used: number;
  quota: number;
  unlimitedLabel: string;
  ofLabel: string;
}) {
  const unlimited = quota === -1;
  const pct = unlimited ? 0 : Math.min(100, (used / Math.max(1, quota)) * 100);
  const danger = pct >= 80;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span className="text-xs text-text-secondary">
          {unlimited
            ? unlimitedLabel
            : `${used.toLocaleString()} ${ofLabel} ${quota.toLocaleString()}`}
        </span>
      </div>
      {!unlimited && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-background">
          <div
            className={`h-full transition-all ${
              danger ? "bg-error" : "bg-primary"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const t = useTranslations("billing");
  const tt = useTranslations("toasts");
  const toast = useToast();
  const locale = useLocale();
  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [cancelNote, setCancelNote] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const cancelReasons: { value: string; labelAr: string; labelEn: string }[] = [
    { value: "too_expensive", labelAr: "السعر مرتفع", labelEn: "Too expensive" },
    { value: "low_usage", labelAr: "لا أستخدمها كثيراً", labelEn: "Not using it enough" },
    { value: "alternative", labelAr: "وجدت بديلاً", labelEn: "Found an alternative" },
    { value: "missing_features", labelAr: "الميزات غير كافية", labelEn: "Missing features" },
    { value: "other", labelAr: "أخرى", labelEn: "Other" },
  ];

  function openCancelModal() {
    setCancelReason(null);
    setCancelNote("");
    setCancelOpen(true);
  }

  function closeCancelModal() {
    setCancelOpen(false);
    setCancelReason(null);
    setCancelNote("");
  }

  async function persistReason(): Promise<void> {
    // Stub telemetry — silently swallow any error.
    try {
      await api.post("/api/v1/feedback/cancellation-reason", {
        reason: cancelReason,
        note: cancelNote,
      });
    } catch {
      // non-blocking
    }
  }

  async function acceptSaveOffer() {
    setCancelSubmitting(true);
    await persistReason();
    setCancelSubmitting(false);
    toast.success(locale === "ar" ? "شكراً لبقائك!" : "Thanks for staying!");
    closeCancelModal();
  }

  async function continueToCancel() {
    setCancelSubmitting(true);
    await persistReason();
    try {
      const res = await api.post<{ url: string }>("/api/v1/billing/portal");
      if (res.url) window.location.href = res.url;
    } catch (e) {
      toast.error(tt("genericError"), e instanceof Error ? e.message : t("errors.failed"));
    } finally {
      setCancelSubmitting(false);
      closeCancelModal();
    }
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [s, u] = await Promise.all([
          api.get<SubscriptionStatus>("/api/v1/billing/subscription"),
          api.get<UsageData>("/api/v1/billing/usage"),
        ]);
        setSub(s);
        setUsage(u);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("errors.failed"));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  async function openPortal() {
    try {
      setManaging(true);
      const res = await api.post<{ url: string }>("/api/v1/billing/portal");
      if (res.url) window.location.href = res.url;
    } catch (e) {
      toast.error(tt("genericError"), e instanceof Error ? e.message : t("errors.failed"));
    } finally {
      setManaging(false);
    }
  }

  if (loading) {
    return (
      <div>
        <DashboardHeader title={t("title")} />
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <DashboardHeader title={t("title")} />
        <div className="p-6">
          <p className="text-sm text-error">{error}</p>
        </div>
      </div>
    );
  }

  const planName = locale === "ar" ? sub?.plan_name_ar : sub?.plan_name_en;
  const renewsOn = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString(
        locale === "ar" ? "ar-EG" : "en-US"
      )
    : "—";

  const anyOver80 = usage
    ? Object.keys(usage.quota).some((k) => {
        const q = usage.quota[k];
        const u = usage.used[k] ?? 0;
        return q !== -1 && q > 0 && (u / q) * 100 >= 80;
      })
    : false;

  return (
    <div>
      <DashboardHeader title={t("title")} />
      <div className="space-y-6 p-6">
        <p className="text-sm text-text-secondary">{t("subtitle")}</p>

        {anyOver80 && (
          <div className="flex items-start gap-3 rounded-xl border border-error/30 bg-error/5 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-error" />
            <p className="text-sm text-error">{t("usage.warning80")}</p>
          </div>
        )}

        {/* Current Plan Card */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-text-secondary">
                {t("currentPlan.title")}
              </p>
              <h2 className="mt-1 text-2xl font-bold text-text-primary">
                {planName}
              </h2>
              <div className="mt-2 flex items-center gap-3 text-sm">
                <span className="rounded-full bg-success/10 px-2.5 py-0.5 font-medium text-success">
                  {t(`status.${sub?.status ?? "active"}` as `status.active`)}
                </span>
                {sub?.current_period_end && (
                  <span className="text-text-muted">
                    {t("currentPlan.renewsOn")}: {renewsOn}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/billing/plans"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
              >
                <ArrowUpRight className="h-4 w-4" />
                {t("currentPlan.upgrade")}
              </Link>
              {sub?.stripe_customer_id && (
                <>
                  <button
                    onClick={openPortal}
                    disabled={managing}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover disabled:opacity-60"
                  >
                    {managing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Settings2 className="h-4 w-4" />
                    )}
                    {t("currentPlan.manage")}
                  </button>
                  <button
                    onClick={openCancelModal}
                    className="inline-flex items-center gap-2 rounded-lg border border-error/40 px-4 py-2 text-sm font-medium text-error hover:bg-error/5"
                  >
                    {locale === "ar" ? "إلغاء الاشتراك" : "Cancel subscription"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Usage */}
        <div>
          <h3 className="mb-3 text-lg font-semibold text-text-primary">
            {t("usage.title")}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <UsageBar
              label={t("usage.articles")}
              used={usage?.used.articles ?? 0}
              quota={usage?.quota.articles ?? 0}
              unlimitedLabel={t("usage.unlimited")}
              ofLabel={t("usage.of")}
            />
            <UsageBar
              label={t("usage.images")}
              used={usage?.used.images ?? 0}
              quota={usage?.quota.images ?? 0}
              unlimitedLabel={t("usage.unlimited")}
              ofLabel={t("usage.of")}
            />
            <UsageBar
              label={t("usage.videos")}
              used={usage?.used.videos ?? 0}
              quota={usage?.quota.videos ?? 0}
              unlimitedLabel={t("usage.unlimited")}
              ofLabel={t("usage.of")}
            />
            <UsageBar
              label={t("usage.aiTokens")}
              used={usage?.used.ai_tokens ?? 0}
              quota={usage?.quota.ai_tokens ?? 0}
              unlimitedLabel={t("usage.unlimited")}
              ofLabel={t("usage.of")}
            />
          </div>
        </div>
      </div>

      {cancelOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/50 p-4 backdrop-blur-sm"
          onClick={closeCancelModal}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-surface-container-lowest p-6 shadow-soft"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h3 className="text-lg font-bold text-on-surface">
                {locale === "ar"
                  ? "لماذا تغادرنا؟"
                  : "Why are you leaving?"}
              </h3>
              <button
                onClick={closeCancelModal}
                className="rounded-xl p-1 text-on-surface-variant hover:bg-surface-container-low"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Save offer view */}
            {cancelReason === "too_expensive" ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                  <Gift className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-on-surface">
                      {locale === "ar"
                        ? "عرض خاص لك: خصم 50% لمدة شهرين"
                        : "Special offer: 50% off for 2 months"}
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {locale === "ar"
                        ? "نريدك أن تبقى معنا. استمر بنصف السعر واستفد من جميع الميزات."
                        : "We want you to stay. Keep everything you love at half the price."}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    onClick={continueToCancel}
                    disabled={cancelSubmitting}
                    className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low disabled:opacity-60"
                  >
                    {locale === "ar"
                      ? "متابعة الإلغاء"
                      : "Continue to cancel"}
                  </button>
                  <button
                    onClick={acceptSaveOffer}
                    disabled={cancelSubmitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
                  >
                    {cancelSubmitting && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {locale === "ar" ? "قبول العرض" : "Accept offer"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  {cancelReasons.map((r) => (
                    <label
                      key={r.value}
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition ${
                        cancelReason === r.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-surface-container-low"
                      }`}
                    >
                      <input
                        type="radio"
                        name="cancel-reason"
                        value={r.value}
                        checked={cancelReason === r.value}
                        onChange={() => setCancelReason(r.value)}
                      />
                      <span className="text-sm text-on-surface">
                        {locale === "ar" ? r.labelAr : r.labelEn}
                      </span>
                    </label>
                  ))}
                </div>

                {cancelReason && cancelReason !== "too_expensive" && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-on-surface-variant">
                      {locale === "ar" ? "أخبرنا المزيد" : "Tell us more"}
                    </label>
                    <textarea
                      value={cancelNote}
                      onChange={(e) => setCancelNote(e.target.value)}
                      rows={3}
                      className="w-full rounded-2xl border border-border bg-surface-container-lowest p-3 text-sm text-on-surface outline-none focus:border-primary"
                      placeholder={
                        locale === "ar"
                          ? "ملاحظاتك تساعدنا على التحسين..."
                          : "Your feedback helps us improve..."
                      }
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={closeCancelModal}
                    className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low"
                  >
                    {locale === "ar" ? "رجوع" : "Back"}
                  </button>
                  <button
                    onClick={continueToCancel}
                    disabled={!cancelReason || cancelSubmitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-error px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {cancelSubmitting && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {locale === "ar"
                      ? "متابعة الإلغاء"
                      : "Continue to cancel"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
