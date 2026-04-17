"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useLocale } from "next-intl";

interface TourStep {
  selector: string;
  ar_title: string;
  ar_text: string;
  en_title: string;
  en_text: string;
}

const TOUR: TourStep[] = [
  {
    selector: '[data-tour="dashboard-home"]',
    ar_title: "مرحباً بك في Ignify",
    ar_text: "هذه لوحتك الرئيسية — كل شيء يبدأ من هنا.",
    en_title: "Welcome",
    en_text: "This is your home — everything starts here.",
  },
  {
    selector: '[data-tour="nav-plans"]',
    ar_title: "الخطط التسويقية",
    ar_text: "أنشئ خطتك التسويقية الكاملة بالذكاء الاصطناعي.",
    en_title: "Marketing Plans",
    en_text: "Build a full AI-generated marketing plan.",
  },
  {
    selector: '[data-tour="nav-content"]',
    ar_title: "توليد المحتوى",
    ar_text: "أنشئ مقالات ومنشورات وصور لكل قنواتك.",
    en_title: "Content",
    en_text: "Generate posts, articles, and images for every channel.",
  },
  {
    selector: '[data-tour="nav-settings"]',
    ar_title: "الإعدادات",
    ar_text: "اضبط نشاطك التجاري وهويتك وقنوات الدفع.",
    en_title: "Settings",
    en_text: "Configure your business, brand, and billing.",
  },
];

const STORAGE_KEY = "ignify_welcome_tour_shown";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function WelcomeTour() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const [mounted, setMounted] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  // Trigger: only mount after 1500ms if the tour has not been shown.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(STORAGE_KEY) === "true") return;
    const timer = window.setTimeout(() => {
      setMounted(true);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, []);

  // Compute target rect whenever step changes or layout changes.
  useLayoutEffect(() => {
    if (!mounted) return;
    function measure() {
      const step = TOUR[stepIdx];
      if (!step) return;
      const el = document.querySelector(step.selector) as HTMLElement | null;
      if (!el) {
        setTargetRect(null);
        return;
      }
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      const r = el.getBoundingClientRect();
      setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    }
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    // Re-measure after scrollIntoView finishes.
    const reTimer = window.setTimeout(measure, 450);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      window.clearTimeout(reTimer);
    };
  }, [mounted, stepIdx]);

  if (!mounted) return null;

  const step = TOUR[stepIdx];
  const total = TOUR.length;
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === total - 1;

  function finish() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "true");
    }
    setMounted(false);
  }

  // Position tooltip below target (or above if near viewport bottom).
  // If target missing, center the tooltip.
  const TOOLTIP_W = 340;
  const TOOLTIP_H_EST = 220;
  const GAP = 12;

  let tooltipStyle: React.CSSProperties = {};
  let ringStyle: React.CSSProperties | null = null;

  if (targetRect && viewport.w > 0) {
    const placeBelow =
      targetRect.top + targetRect.height + GAP + TOOLTIP_H_EST <= viewport.h - 12;
    const top = placeBelow
      ? targetRect.top + targetRect.height + GAP
      : Math.max(12, targetRect.top - GAP - TOOLTIP_H_EST);
    let left = targetRect.left + targetRect.width / 2 - TOOLTIP_W / 2;
    left = Math.max(12, Math.min(left, viewport.w - TOOLTIP_W - 12));
    tooltipStyle = {
      position: "fixed",
      top,
      left,
      width: TOOLTIP_W,
      zIndex: 10001,
    };
    ringStyle = {
      position: "fixed",
      top: targetRect.top - 6,
      left: targetRect.left - 6,
      width: targetRect.width + 12,
      height: targetRect.height + 12,
      zIndex: 10000,
      pointerEvents: "none",
    };
  } else {
    tooltipStyle = {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: TOOLTIP_W,
      zIndex: 10001,
    };
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isAr ? "جولة ترحيبية" : "Welcome tour"}
      className="fixed inset-0 z-[9999] bg-on-surface/50 backdrop-blur-sm"
      onClick={(e) => {
        // Clicking on the backdrop (not the tooltip) does nothing — only explicit buttons advance/dismiss.
        e.stopPropagation();
      }}
    >
      {ringStyle && (
        <div
          style={ringStyle}
          className="rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0)] ring-4 ring-primary ring-offset-2 ring-offset-transparent transition-all duration-300"
        />
      )}

      <div style={tooltipStyle} className="overflow-hidden rounded-3xl bg-surface-container-lowest shadow-2xl">
        <div className="brand-gradient px-5 py-3 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/80">
            {isAr ? `الخطوة ${stepIdx + 1} من ${total}` : `Step ${stepIdx + 1} of ${total}`}
          </p>
          <h3 className="mt-0.5 font-headline text-lg font-bold">
            {isAr ? step.ar_title : step.en_title}
          </h3>
        </div>
        <div className="p-5">
          <p className="text-sm leading-relaxed text-on-surface">
            {isAr ? step.ar_text : step.en_text}
          </p>
          <div className="mt-5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={finish}
              className="text-xs font-semibold text-on-surface-variant hover:text-on-surface"
            >
              {isAr ? "تخطي" : "Skip"}
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                disabled={isFirst}
                className="rounded-xl bg-surface-container px-4 py-2 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-40"
              >
                {isAr ? "السابق" : "Prev"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isLast) finish();
                  else setStepIdx((i) => i + 1);
                }}
                className="brand-gradient rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-soft transition-transform hover:scale-[1.02]"
              >
                {isLast ? (isAr ? "إنهاء" : "Finish") : isAr ? "التالي" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
