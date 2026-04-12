"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Flame, Mail } from "lucide-react";

export default function ResendVerificationPage() {
  const t = useTranslations("verify");
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  const [hydrated, setHydrated] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.push("/login");
    } else if (user?.email) {
      setEmail(user.email);
    }
  }, [hydrated, isAuthenticated, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/api/v1/auth/resend-verification", {});
      setSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!hydrated) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <Flame className="h-7 w-7 text-primary" />
          <span className="text-2xl font-bold text-primary">Ignify</span>
        </div>

        <h1 className="text-center text-xl font-semibold">{t("resendPage.title")}</h1>

        {sent ? (
          <p className="mt-6 rounded-md bg-green-50 p-4 text-center text-sm text-green-700">
            {t("resent")}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("resendPage.email")}</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled
                  className="w-full rounded-md border border-border bg-surface-hover py-2 pe-3 ps-10 text-sm"
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{t("errors.failed")}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? t("resending") : t("resendPage.submit")}
            </button>
          </form>
        )}

        <div className="mt-4 text-center text-sm">
          <Link href="/dashboard" className="text-primary hover:underline">
            {t("goToDashboard")}
          </Link>
        </div>
      </div>
    </div>
  );
}
