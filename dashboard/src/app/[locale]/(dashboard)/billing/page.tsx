"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import DashboardHeader from "@/components/DashboardHeader";
import { Loader2, AlertTriangle, ArrowUpRight, Settings2, X, Gift, Zap, Sparkles, CreditCard, CheckCircle, Clock } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/Toaster";
import AIUsageWidget from "@/components/AIUsageWidget";
import { useAuthStore } from "@/store/auth.store";

// ── Types ────────────────────────────────────────────────────────────────────

interface Plan {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  price_usd: number;
}

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

interface OfflinePaymentRequest {
  id: string;
  amount: number;
  currency: string;
  payment_method: string;
  reference_number: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

export default function BillingPage() {
  const t = useTranslations("billing");
  const tt = useTranslations("toasts");
  const toast = useToast();
  const locale = useLocale();
  const { tenant } = useAuthStore();
  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);

  // Offline payment form
  const [plans, setPlans] = useState<Plan[]>([]);
  const [offlinePayments, setOfflinePayments] = useState<OfflinePaymentRequest[]>([]);
  const [offlineLoading, setOfflineLoading] = useState(false);
  const [offlinePlanCode, setOfflinePlanCode] = useState("");
  const [offlineAmount, setOfflineAmount] = useState("");
  const [offlineCurrency, setOfflineCurrency] = useState("USD");
  const [offlineMethod, setOfflineMethod] = useState("bank_transfer");
  const [offlineRef, setOfflineRef] = useState("");
  const [offlineNotes, setOfflineNotes] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [cancelNote, setCancelNote] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [topupBusy, setTopupBusy] = useState<number | null>(null);
  const [topupUnavailable, setTopupUnavailable] = useState(false);

  const topupTiers = [
    {
      amount: 10,
      fast: 800,
      medium: 26,
      deep: 17,
      popular: false,
    },
    {
      amount: 25,
      fast: 2000,
      medium: 66,
      deep: 42,
      popular: true,
    },
    {
      amount: 50,
      fast: 4000,
      medium: 132,
      deep: 85,
      popular: false,
    },
  ];

  async function handleTopup(amount: number) {
    setTopupBusy(amount);
    try {
      const res = await api.post<{ url?: string }>(
        "/api/v1/billing/credits/topup",
        { amount_usd: amount }
      );
      if (res?.url) {
        window.location.href = res.url;
        return;
      }
      toast.success(
        locale === "ar" ? "تم بدء عملية الشراء" : "Top-up initiated"
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setTopupUnavailable(true);
        toast.info(locale === "ar" ? "قادم قريباً" : "Coming soon");
      } else {
        toast.error(
          tt("genericError"),
          e instanceof Error ? e.message : t("errors.failed")
        );
      }
    } finally {
      setTopupBusy(null);
    }
  }

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
        const [s, u, payments, planList] = await Promise.all([
          api.get<SubscriptionStatus>("/api/v1/billing/subscription").catch(() => null),
          api.get<UsageData>("/api/v1/billing/usage").catch(() => null),
          api.get<OfflinePaymentRequest[]>("/api/v1/billing/offline-payment/my").catch(() => []),
          api.get<Plan[]>("/api/v1/billing/plans").catch(() => []),
        ]);
        if (s) setSub(s);
        if (u) setUsage(u);
        setOfflinePayments(payments ?? []);
        const activePlans = planList ?? [];
        setPlans(activePlans);
        if (activePlans.length > 0) setOfflinePlanCode(activePlans[0].code);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("errors.failed"));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  async function submitOfflinePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!offlineAmount || isNaN(Number(offlineAmount))) return;
    setOfflineLoading(true);
    try {
      const res = await api.post<OfflinePaymentRequest>("/api/v1/billing/offline-payment", {
        plan_code: offlinePlanCode,
        amount: Number(offlineAmount),
        currency: offlineCurrency,
        payment_method: offlineMethod,
        reference_number: offlineRef || null,
        notes: offlineNotes || null,
      });
      setOfflinePayments((prev) => [res, ...prev]);
      setOfflineAmount("");
      setOfflineRef("");
      setOfflineNotes("");
      toast.success(
        locale === "ar" ? "تم إرسال طلب الدفع" : "Payment request submitted",
        locale === "ar" ? "سيقوم الفريق بمراجعته قريباً" : "Our team will review it shortly"
      );
    } catch (e) {
      toast.error(tt("genericError"), e instanceof Error ? e.message : "");
    } finally {
      setOfflineLoading(false);
    }
  }

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

  const isSubscribed = tenant?.subscription_active;

  return (
    <div>
      <DashboardHeader title={t("title")} />
      <div className="space-y-6 p-6">
        <p className="text-sm text-text-secondary">{t("subtitle")}</p>

        {/* Offline / manual payment section — always shown */}
        <div className="rounded-2xl border border-border bg-surface-container-low p-6">
          <div className="mb-4 flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-on-surface">
              {locale === "ar" ? "الدفع اليدوي / التحويل البنكي" : "Manual / Offline Payment"}
            </h3>
            {isSubscribed && (
              <span className="ms-auto flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                <CheckCircle className="h-3 w-3" />
                {locale === "ar" ? "مفعّل" : "Active"}
              </span>
            )}
          </div>

          {/* Bank details */}
          <div className="mb-5 rounded-xl bg-surface-container p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {locale === "ar" ? "بيانات الحساب البنكي" : "Bank Account Details"}
            </p>
            <div className="grid gap-1 text-sm text-on-surface sm:grid-cols-2">
              <div><span className="font-medium">{locale === "ar" ? "البنك:" : "Bank:"}</span> Banque Misr</div>
              <div><span className="font-medium">{locale === "ar" ? "اسم الحساب:" : "Account name:"}</span> Ignify Technologies</div>
              <div><span className="font-medium">{locale === "ar" ? "رقم الحساب:" : "Account no:"}</span> 1234567890</div>
              <div><span className="font-medium">IBAN:</span> EG00 0002 0000 0000 0000 1234 5678</div>
            </div>
          </div>

          {/* Submission form */}
          <form onSubmit={submitOfflinePayment} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-on-surface-variant">
                  {locale === "ar" ? "الباقة" : "Plan"}
                </label>
                <select
                  value={offlinePlanCode}
                  onChange={(e) => setOfflinePlanCode(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
                >
                  {plans.map((pl) => (
                    <option key={pl.code} value={pl.code}>
                      {locale === "ar" ? pl.name_ar : pl.name_en}
                      {pl.price_usd > 0 ? ` – $${pl.price_usd}/mo` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-on-surface-variant">
                  {locale === "ar" ? "طريقة الدفع" : "Payment method"}
                </label>
                <select
                  value={offlineMethod}
                  onChange={(e) => setOfflineMethod(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
                >
                  <option value="bank_transfer">{locale === "ar" ? "تحويل بنكي" : "Bank transfer"}</option>
                  <option value="cash">{locale === "ar" ? "نقدي" : "Cash"}</option>
                  <option value="check">{locale === "ar" ? "شيك" : "Check"}</option>
                  <option value="other">{locale === "ar" ? "أخرى" : "Other"}</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-on-surface-variant">
                  {locale === "ar" ? "المبلغ" : "Amount"}
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={offlineAmount}
                    onChange={(e) => setOfflineAmount(e.target.value)}
                    placeholder="29.00"
                    className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
                  />
                  <select
                    value={offlineCurrency}
                    onChange={(e) => setOfflineCurrency(e.target.value)}
                    className="rounded-xl border border-outline-variant bg-surface px-2 py-2 text-sm text-on-surface"
                  >
                    <option value="USD">USD</option>
                    <option value="EGP">EGP</option>
                    <option value="SAR">SAR</option>
                    <option value="AED">AED</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-on-surface-variant">
                  {locale === "ar" ? "رقم مرجع التحويل (اختياري)" : "Transfer reference no. (optional)"}
                </label>
                <input
                  type="text"
                  value={offlineRef}
                  onChange={(e) => setOfflineRef(e.target.value)}
                  placeholder={locale === "ar" ? "مثل: TXN123456" : "e.g. TXN123456"}
                  className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
                />
              </div>
            </div>
            <textarea
              value={offlineNotes}
              onChange={(e) => setOfflineNotes(e.target.value)}
              rows={2}
              placeholder={locale === "ar" ? "ملاحظات إضافية (اختياري)" : "Additional notes (optional)"}
              className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
            />
            <button
              type="submit"
              disabled={offlineLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary hover:opacity-90 disabled:opacity-60"
            >
              {offlineLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              {locale === "ar" ? "إرسال طلب الدفع" : "Submit payment request"}
            </button>
          </form>

          {/* Previous requests */}
          {offlinePayments.length > 0 && (
            <div className="mt-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                {locale === "ar" ? "طلباتك السابقة" : "Your requests"}
              </p>
              {offlinePayments.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-3 text-sm"
                >
                  <div className="flex items-center gap-2">
                    {p.status === "approved" ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : p.status === "rejected" ? (
                      <X className="h-4 w-4 text-error" />
                    ) : (
                      <Clock className="h-4 w-4 text-warning" />
                    )}
                    <span className="font-medium text-on-surface">
                      {p.amount} {p.currency}
                    </span>
                    <span className="text-on-surface-variant">{p.payment_method.replace("_", " ")}</span>
                    {p.reference_number && (
                      <span className="text-on-surface-variant">#{p.reference_number}</span>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      p.status === "approved"
                        ? "bg-success/10 text-success"
                        : p.status === "rejected"
                        ? "bg-error/10 text-error"
                        : "bg-warning/10 text-warning"
                    }`}
                  >
                    {p.status === "approved"
                      ? locale === "ar" ? "تمت الموافقة" : "Approved"
                      : p.status === "rejected"
                      ? locale === "ar" ? "مرفوض" : "Rejected"
                      : locale === "ar" ? "قيد المراجعة" : "Pending"}
                  </span>
                  {p.admin_notes && (
                    <p className="w-full text-xs text-on-surface-variant">{p.admin_notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

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

        {/* AI Credit Balance */}
        <AIUsageWidget />

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

        {/* Top-up credits */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-text-primary">
              {locale === "ar" ? "شحن الرصيد" : "Top up credits"}
            </h3>
          </div>
          <p className="mb-4 text-sm text-text-secondary">
            {locale === "ar"
              ? "أضف رصيداً فورياً لمواصلة التوليد دون انتظار التجديد الشهري."
              : "Add credits instantly to keep generating without waiting for your monthly renewal."}
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {topupTiers.map((tier) => {
              const isPopular = tier.popular;
              const busy = topupBusy === tier.amount;
              const disabled = topupUnavailable || busy;
              return (
                <div
                  key={tier.amount}
                  className={`relative flex flex-col rounded-xl border bg-surface p-5 shadow-sm transition ${
                    isPopular
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border"
                  }`}
                >
                  {isPopular && (
                    <span className="absolute -top-3 start-4 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white shadow-sm">
                      <Sparkles className="h-3 w-3" />
                      {locale === "ar" ? "الأكثر شعبية" : "Most popular"}
                    </span>
                  )}
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-text-primary">
                      ${tier.amount}
                    </span>
                    <span className="text-sm text-text-muted">
                      {locale === "ar" ? "لمرة واحدة" : "one-time"}
                    </span>
                  </div>
                  <ul className="mt-4 flex-1 space-y-1.5 text-sm text-text-secondary">
                    <li>
                      {locale === "ar"
                        ? `≈ ${tier.fast.toLocaleString()} توليد سريع`
                        : `≈ ${tier.fast.toLocaleString()} fast generations`}
                    </li>
                    <li>
                      {locale === "ar"
                        ? `≈ ${tier.medium} توليد متوسط`
                        : `≈ ${tier.medium} medium generations`}
                    </li>
                    <li>
                      {locale === "ar"
                        ? `≈ ${tier.deep} توليد عميق`
                        : `≈ ${tier.deep} deep generations`}
                    </li>
                  </ul>
                  <button
                    onClick={() => handleTopup(tier.amount)}
                    disabled={disabled}
                    className={`mt-5 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                      topupUnavailable
                        ? "cursor-not-allowed bg-background text-text-muted"
                        : isPopular
                          ? "bg-primary text-white hover:bg-primary-dark"
                          : "border border-border bg-surface text-text-primary hover:bg-surface-hover"
                    } disabled:opacity-60`}
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {topupUnavailable
                      ? locale === "ar"
                        ? "قائمة الانتظار"
                        : "Waitlist"
                      : locale === "ar"
                        ? "شراء"
                        : "Buy"}
                  </button>
                </div>
              );
            })}
          </div>
          {topupUnavailable && (
            <p className="mt-3 text-xs text-text-muted">
              {locale === "ar"
                ? "خاصية الشحن قادمة قريباً — سنخبرك عند توفرها."
                : "Credit top-ups are coming soon — we'll notify you when available."}
            </p>
          )}
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
