"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";

const STEPS = ["business", "brand", "channels", "plan"] as const;
const TOTAL = STEPS.length;

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("onboarding");
  const pathname = usePathname();

  const currentIdx = Math.max(
    0,
    STEPS.findIndex((s) => pathname.includes(`/onboarding/${s}`))
  );
  const currentStep = currentIdx + 1;
  const progress = (currentStep / TOTAL) * 100;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-2xl font-bold text-text-primary">{t("welcome")}</h1>
          <div className="mb-2 flex items-center justify-between text-sm text-text-secondary">
            <span>
              {t("progressStep", { step: currentStep })} {t("of")} {TOTAL}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-3 flex gap-2">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full ${
                  i <= currentIdx ? "bg-primary" : "bg-surface"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
