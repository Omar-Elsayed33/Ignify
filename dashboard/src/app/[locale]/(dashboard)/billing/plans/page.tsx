"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAutoCurrency } from "@/lib/useAutoCurrency";

interface PlanItem {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  price_usd: number;
  price_egp: number;
  prices?: Record<string, { monthly: number; yearly: number }>;
  features: string[];
  limits: Record<string, number>;
  popular: boolean;
}

interface SubscriptionStatus {
  plan_code: string;
}

type Currency = "usd" | "egp" | "sar" | "aed";
type Provider = "stripe" | "paymob" | "paytabs" | "geidea";

const CURRENCIES: Currency[] = ["usd", "egp", "sar", "aed"];

// Approx FX from USD for display purposes (authoritative amounts come from backend)
const FX_FROM_USD: Record<Currency, number> = {
  usd: 1,
  egp: 50,
  sar: 3.75,
  aed: 3.67,
};

const CURRENCY_SYMBOL: Record<Currency, string> = {
  usd: "$",
  egp: "EGP ",
  sar: "SAR ",
  aed: "AED ",
};

function providersForCurrency(currency: Currency): Provider[] {
  if (currency === "usd") return ["stripe"];
  if (currency === "egp") return ["paymob", "paytabs", "geidea"];
  // sar, aed
  return ["paytabs", "geidea"];
}

export default function PlansPage() {
  const t = useTranslations("billing");
  const locale = useLocale();
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [currentCode, setCurrentCode] = useState<string | null>(null);
  const { currency: autoCurrency, setCurrency: setAutoCurrency } =
    useAutoCurrency("USD");
  const currency = autoCurrency.toLowerCase() as Currency;
  const setCurrency = (c: Currency) => setAutoCurrency(c.toUpperCase());
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerPlan, setPickerPlan] = useState<PlanItem | null>(null);
  const [pickedProvider, setPickedProvider] = useState<Provider | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [p, s] = await Promise.all([
          api.get<PlanItem[]>("/api/v1/billing/plans"),
          api
            .get<SubscriptionStatus>("/api/v1/billing/subscription")
            .catch(() => null),
        ]);
        setPlans(p);
        if (s) setCurrentCode(s.plan_code);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("errors.failed"));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  function openPicker(plan: PlanItem) {
    const options = providersForCurrency(currency);
    setPickerPlan(plan);
    setPickedProvider(options[0] ?? null);
  }

  async function confirmSubscribe() {
    if (!pickerPlan || !pickedProvider) return;
    const plan = pickerPlan;
    const provider = pickedProvider;
    try {
      setSubscribing(plan.code);
      const res = await api.post<{ url: string }>("/api/v1/billing/checkout", {
        plan_code: plan.code,
        provider,
        currency,
      });
      if (res.url) window.location.href = res.url;
    } catch (e) {
      alert(e instanceof Error ? e.message : t("errors.failed"));
    } finally {
      setSubscribing(null);
      setPickerPlan(null);
      setPickedProvider(null);
    }
  }

  function getDisplayPrice(plan: PlanItem, c: Currency): number {
    const key = c.toUpperCase();
    const entry = plan.prices?.[key];
    if (entry && typeof entry.monthly === "number") return entry.monthly;
    if (c === "usd") return plan.price_usd;
    if (c === "egp") return plan.price_egp;
    return Math.round(plan.price_usd * FX_FROM_USD[c] * 100) / 100;
  }

  if (loading) {
    return (
      <div>
        <DashboardHeader title={t("plans.title")} />
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <DashboardHeader title={t("plans.title")} />
        <div className="p-6">
          <p className="text-sm text-error">{error}</p>
        </div>
      </div>
    );
  }

  const providerOptions = pickerPlan ? providersForCurrency(currency) : [];

  return (
    <div>
      <DashboardHeader title={t("plans.title")} />
      <div className="p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-text-secondary">{t("plans.subtitle")}</p>
          <div className="flex rounded-lg border border-border bg-surface p-1">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  currency === c
                    ? "bg-primary text-white"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {c.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const name = locale === "ar" ? plan.name_ar : plan.name_en;
            const price = getDisplayPrice(plan, currency);
            const isCurrent = currentCode === plan.code;
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-xl border bg-surface p-6 shadow-sm ${
                  plan.popular
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border"
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 start-4 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                    <Sparkles className="h-3 w-3" />
                    {t("plans.popular")}
                  </span>
                )}
                <h3 className="text-lg font-bold text-text-primary">{name}</h3>
                <div className="my-4">
                  <span className="text-3xl font-bold text-text-primary">
                    {CURRENCY_SYMBOL[currency]}
                    {price.toLocaleString()}
                  </span>
                  <span className="text-sm text-text-muted">
                    {" "}
                    / {t("plans.perMonth")}
                  </span>
                </div>
                <ul className="mb-6 flex-1 space-y-2">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-sm text-text-secondary"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span className="capitalize">{f.replace(/_/g, " ")}</span>
                    </li>
                  ))}
                </ul>
                <button
                  disabled={isCurrent || subscribing === plan.code}
                  onClick={() => openPicker(plan)}
                  className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                    isCurrent
                      ? "cursor-not-allowed bg-background text-text-muted"
                      : "bg-primary text-white hover:bg-primary-dark"
                  } disabled:opacity-60`}
                >
                  {subscribing === plan.code && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {isCurrent ? t("plans.currentPlan") : t("plans.subscribe")}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {pickerPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h3 className="text-lg font-bold text-text-primary">
                {t("providers.title")}
              </h3>
              <button
                onClick={() => {
                  setPickerPlan(null);
                  setPickedProvider(null);
                }}
                className="rounded p-1 text-text-muted hover:bg-background"
                aria-label={t("providers.cancel")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              {providerOptions.map((p) => (
                <label
                  key={p}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                    pickedProvider === p
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-background"
                  }`}
                >
                  <input
                    type="radio"
                    name="provider"
                    value={p}
                    checked={pickedProvider === p}
                    onChange={() => setPickedProvider(p)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-text-primary">
                      {t(`providers.${p}`)}
                    </div>
                    <div className="text-xs text-text-muted">
                      {t(`providers.${p}Desc`)}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setPickerPlan(null);
                  setPickedProvider(null);
                }}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background"
              >
                {t("providers.cancel")}
              </button>
              <button
                onClick={confirmSubscribe}
                disabled={!pickedProvider || subscribing === pickerPlan.code}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {subscribing === pickerPlan.code && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {t("providers.select")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
