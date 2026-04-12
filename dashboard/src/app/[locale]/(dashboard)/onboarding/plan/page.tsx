"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";

interface OnboardingStatus {
  business_profile?: { primary_language?: string } | null;
}

interface PlanResponse {
  id: string;
}

const STEPS = ["market", "audience", "channels", "calendar", "kpis"] as const;

export default function OnboardingPlanPage() {
  const t = useTranslations("onboarding");
  const router = useRouter();

  const [generating, setGenerating] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    setActiveStep(0);

    // Animate step progression visually
    const interval = setInterval(() => {
      setActiveStep((s) => (s < STEPS.length - 1 ? s + 1 : s));
    }, 1500);

    try {
      const status = await api.get<OnboardingStatus>("/api/v1/onboarding/status");
      const language = status.business_profile?.primary_language || "ar";
      const plan = await api.post<PlanResponse>("/api/v1/plans/generate", {
        title: "First Marketing Plan",
        period_days: 30,
        language: language === "both" ? "both" : language,
      });

      clearInterval(interval);
      setActiveStep(STEPS.length);

      await api.post("/api/v1/onboarding/complete");
      router.push(`/plans/${plan.id}`);
    } catch {
      clearInterval(interval);
      setError(t("errors.failed"));
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-text-primary">{t("plan.title")}</h2>
        <p className="mt-1 text-sm text-text-secondary">{t("plan.subtitle")}</p>
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-background p-4">
        {STEPS.map((s, i) => {
          const done = i < activeStep;
          const current = i === activeStep;
          return (
            <div key={s} className="flex items-center gap-3 text-sm">
              {done ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : current ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <div className="h-5 w-5 rounded-full border border-border" />
              )}
              <span className={done || current ? "text-text-primary" : "text-text-secondary"}>
                {t(`plan.steps.${s}`)}
              </span>
            </div>
          );
        })}
      </div>

      {error && <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</div>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("plan.generating")}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {t("plan.generate")}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
