"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { Loader2, Sparkles, CheckCircle2, ArrowRight } from "lucide-react";

const FEATURES = [
  "خطط تسويقية مدعومة بالذكاء الاصطناعي",
  "تحليل المنافسين والسوق",
  "تقويم محتوى ذكي",
  "مؤشرات KPI مخصصة لنشاطك",
  "استراتيجية إعلانات متكاملة",
];

export default function OnboardingPlanPage() {
  const t = useTranslations("onboarding");
  const router = useRouter();

  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = async () => {
    setCompleting(true);
    setError(null);
    try {
      await api.post("/api/v1/onboarding/complete");
      router.push("/dashboard");
    } catch {
      setError(t("errors.failed"));
      setCompleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-text-primary">{t("plan.title")}</h2>
        <p className="mt-1 text-sm text-text-secondary">{t("plan.subtitle")}</p>
      </div>

      {/* Features list */}
      <div className="space-y-3 rounded-lg border border-border bg-background p-4">
        {FEATURES.map((f) => (
          <div key={f} className="flex items-center gap-3 text-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
            <span className="text-text-primary">{f}</span>
          </div>
        ))}
      </div>

      <p className="text-sm text-text-secondary">
        يمكنك إنشاء خطتك التسويقية الأولى في أي وقت من قائمة <strong>الخطط</strong>.
      </p>

      {error && (
        <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleComplete}
          disabled={completing}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {completing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              جارٍ الإعداد...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {t("plan.complete") ?? "ابدأ رحلتك"}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
