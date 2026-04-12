"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/store/auth.store";
import { api, BASE_URL } from "@/lib/api";
import { Link, useRouter } from "@/i18n/navigation";
import { Flame, Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const { login } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const tokens = await api.post<{
        access_token: string;
        refresh_token: string;
        token_type: string;
      }>("/api/v1/auth/login", { email, password });

      const user = await fetch(`${BASE_URL}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }).then((r) => r.json());

      const tenant = await fetch(`${BASE_URL}/api/v1/tenants/me`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }).then((r) => r.json());

      login(user, tenant, tokens.access_token, tokens.refresh_token);

      if (user.role === "superadmin") {
        router.push("/admin/dashboard");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8 flex items-center gap-2 lg:hidden">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
          <Flame className="h-6 w-6 text-white" />
        </div>
        <span className="text-2xl font-bold text-secondary">Ignify</span>
      </div>

      <h2 className="text-2xl font-bold text-text-primary">{t("loginTitle")}</h2>
      <p className="mt-2 text-sm text-text-secondary">{t("loginSubtitle")}</p>

      {error && (
        <div className="mt-4 rounded-lg bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-primary">
            {t("email")}
          </label>
          <div className="relative">
            <Mail className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background py-2.5 ps-10 pe-4 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="you@company.com"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-primary">
            {t("password")}
          </label>
          <div className="relative">
            <Lock className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background py-2.5 ps-10 pe-4 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="********"
            />
          </div>
        </div>

        <div className="flex items-center justify-end">
          <a href="#" className="text-sm font-medium text-primary hover:text-primary-dark">
            {t("forgotPassword")}
          </a>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
        >
          {loading ? t("signingIn") : t("login")}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-text-secondary">
        {t("noAccount")}{" "}
        <Link
          href="/register"
          className="font-medium text-primary hover:text-primary-dark"
        >
          {t("register")}
        </Link>
      </p>
    </div>
  );
}
