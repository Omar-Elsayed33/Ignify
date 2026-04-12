"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BASE_URL } from "@/lib/api";
import { Flame, CheckCircle2, XCircle, Loader2 } from "lucide-react";

type Status = "verifying" | "success" | "failed";

export default function VerifyEmailPage() {
  const t = useTranslations("verify");
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<Status>("verifying");
  const [errorKey, setErrorKey] = useState<"invalid" | "expired" | "failed">("failed");

  useEffect(() => {
    if (!token) {
      setStatus("failed");
      setErrorKey("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/v1/auth/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (res.ok) {
          setStatus("success");
        } else {
          const data = await res.json().catch(() => ({}));
          const detail = data?.detail;
          setErrorKey(detail === "expired" ? "expired" : detail === "invalid" ? "invalid" : "failed");
          setStatus("failed");
        }
      } catch {
        setStatus("failed");
        setErrorKey("failed");
      }
    })();
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <Flame className="h-7 w-7 text-primary" />
          <span className="text-2xl font-bold text-primary">Ignify</span>
        </div>

        {status === "verifying" && (
          <div className="flex flex-col items-center text-center">
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
            <h1 className="text-xl font-semibold">{t("title")}</h1>
            <p className="mt-2 text-sm text-text-secondary">{t("verifying")}</p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center text-center">
            <CheckCircle2 className="mb-4 h-12 w-12 text-green-500" />
            <h1 className="text-xl font-semibold">{t("successTitle")}</h1>
            <p className="mt-2 text-sm text-text-secondary">{t("successMessage")}</p>
            <Link
              href="/dashboard"
              className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
            >
              {t("goToDashboard")}
            </Link>
          </div>
        )}

        {status === "failed" && (
          <div className="flex flex-col items-center text-center">
            <XCircle className="mb-4 h-12 w-12 text-red-500" />
            <h1 className="text-xl font-semibold">{t("failedTitle")}</h1>
            <p className="mt-2 text-sm text-text-secondary">
              {t(`errors.${errorKey}`)}
            </p>
            <Link
              href="/verify/resend"
              className="mt-6 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface-hover"
            >
              {t("resendButton")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
