"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { Mail, X } from "lucide-react";

const DISMISS_KEY = "ignify_verify_banner_dismissed";

interface MeResponse {
  email_verified?: boolean;
  email_verified_at?: string | null;
}

export default function EmailVerificationBanner() {
  const t = useTranslations("verify.banner");
  const { isAuthenticated, user, setUser } = useAuthStore();
  const [verified, setVerified] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const me = await api.get<MeResponse & Record<string, unknown>>("/api/v1/auth/me");
        if (cancelled) return;
        setVerified(Boolean(me.email_verified));
        if (user) {
          setUser({ ...user, email_verified: Boolean(me.email_verified) });
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  if (!isAuthenticated || verified !== false || dismissed) return null;

  return (
    <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <Mail className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1">
        {t("message")}{" "}
        <Link href="/verify/resend" className="font-medium underline hover:no-underline">
          {t("action")}
        </Link>
      </span>
      <button
        onClick={handleDismiss}
        className="rounded p-1 hover:bg-amber-100"
        aria-label={t("dismiss")}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
