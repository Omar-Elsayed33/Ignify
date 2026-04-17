"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { X, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { useToast } from "@/components/Toaster";

const STORAGE_KEY = "ignify_nps_v1";
const MIN_AGE_DAYS = 30;

interface MeResponse {
  id: string;
  email: string;
  created_at?: string | null;
}

export default function NPSWidget() {
  const locale = useLocale();
  const toast = useToast();
  const { isAuthenticated } = useAuthStore();
  const [visible, setVisible] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof window === "undefined") return;

    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing === "submitted" || existing === "dismissed") return;

    let cancelled = false;
    (async () => {
      try {
        const me = await api.get<MeResponse>("/api/v1/auth/me");
        if (cancelled) return;
        if (!me?.created_at) return;
        const createdAt = new Date(me.created_at).getTime();
        if (Number.isNaN(createdAt)) return;
        const ageMs = Date.now() - createdAt;
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        if (ageDays >= MIN_AGE_DAYS) {
          // Small delay so it doesn't pop during first paint.
          setTimeout(() => {
            if (!cancelled) setVisible(true);
          }, 2000);
        }
      } catch {
        // fail silent
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  function dismiss() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "dismissed");
    }
    setVisible(false);
  }

  async function submit() {
    if (score === null) return;
    setSubmitting(true);
    try {
      await api.post("/api/v1/feedback/nps", { score, note });
    } catch {
      // stub endpoint — swallow
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "submitted");
    }
    setSubmitting(false);
    setVisible(false);
    toast.success(
      locale === "ar" ? "شكراً على تقييمك!" : "Thanks for your feedback!"
    );
  }

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-24 end-6 z-40 w-[min(22rem,calc(100vw-3rem))] animate-in slide-in-from-bottom-4 rounded-3xl border border-border bg-surface-container-lowest p-5 shadow-soft"
      role="dialog"
      aria-label="NPS survey"
    >
      <button
        onClick={dismiss}
        className="absolute end-3 top-3 rounded-xl p-1 text-on-surface-variant hover:bg-surface-container-low"
        aria-label={locale === "ar" ? "إغلاق" : "Dismiss"}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>

      <p className="pe-6 text-sm font-semibold text-on-surface">
        {locale === "ar"
          ? "كيف تقيّم Ignify من 0 إلى 10؟"
          : "How would you rate Ignify, 0-10?"}
      </p>

      <div className="mt-3 grid grid-cols-11 gap-1">
        {Array.from({ length: 11 }, (_, i) => i).map((n) => (
          <button
            key={n}
            onClick={() => setScore(n)}
            aria-label={locale === "ar" ? `تقييم ${n}` : `Rate ${n}`}
            aria-pressed={score === n}
            className={`rounded-lg px-1 py-1.5 text-xs font-medium transition ${
              score === n
                ? "bg-primary text-white"
                : "bg-surface-container-low text-on-surface-variant hover:bg-primary/10"
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="mt-2 flex justify-between text-[10px] text-on-surface-variant">
        <span>
          {locale === "ar" ? "غير محتمل" : "Not likely"}
        </span>
        <span>
          {locale === "ar" ? "محتمل جداً" : "Very likely"}
        </span>
      </div>

      {score !== null && (
        <div className="mt-3 space-y-2">
          <label className="block text-xs font-medium text-on-surface-variant">
            {locale === "ar" ? "ما السبب؟" : "Why?"}
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-2xl border border-border bg-surface-container-lowest p-2 text-sm text-on-surface outline-none focus:border-primary"
            placeholder={
              locale === "ar"
                ? "شاركنا رأيك..."
                : "Share your thoughts..."
            }
          />
          <button
            onClick={submit}
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {locale === "ar" ? "إرسال" : "Submit"}
          </button>
        </div>
      )}
    </div>
  );
}
