"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AlertTriangle, X } from "lucide-react";
import { api } from "@/lib/api";

interface UsageData {
  quota: Record<string, number>;
  used: Record<string, number>;
  remaining: Record<string, number>;
}

export default function QuotaBanner() {
  const t = useTranslations("billing");
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const u = await api.get<UsageData>("/api/v1/billing/usage");
        if (cancelled) return;
        const over = Object.keys(u.quota).some((k) => {
          const q = u.quota[k];
          const used = u.used[k] ?? 0;
          return q !== -1 && q > 0 && (used / q) * 100 >= 80;
        });
        setShow(over);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show || dismissed) return null;

  return (
    <div className="flex items-start gap-3 border-b border-error/30 bg-error/5 px-6 py-3">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-error" />
      <p className="flex-1 text-sm text-error">
        {t("usage.warning80")}{" "}
        <Link
          href="/billing/plans"
          className="font-medium underline hover:opacity-80"
        >
          {t("currentPlan.upgrade")}
        </Link>
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="rounded p-1 text-error hover:bg-error/10"
        aria-label="dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
