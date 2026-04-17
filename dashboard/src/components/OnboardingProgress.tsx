"use client";

import { useLocale } from "next-intl";
import { Check } from "lucide-react";
import { clsx } from "clsx";

const STEPS = [
  { key: "business", ar: "النشاط", en: "Business" },
  { key: "brand", ar: "الهوية", en: "Brand" },
  { key: "channels", ar: "القنوات", en: "Channels" },
  { key: "plan", ar: "جاهز", en: "Ready" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

export default function OnboardingProgress({ current }: { current: StepKey }) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="mx-auto mb-8 flex max-w-2xl items-center gap-2">
      {STEPS.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s.key} className="flex flex-1 items-center gap-2">
            <div
              className={clsx(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1",
                done
                  ? "bg-primary text-on-primary ring-primary"
                  : active
                    ? "brand-gradient text-white ring-transparent shadow-soft"
                    : "bg-surface-container-highest text-on-surface-variant ring-outline/20"
              )}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={clsx(
                "text-xs font-medium",
                active ? "text-on-surface" : "text-on-surface-variant"
              )}
            >
              {isAr ? s.ar : s.en}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={clsx(
                  "h-0.5 flex-1",
                  done ? "bg-primary" : "bg-surface-container-highest"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
