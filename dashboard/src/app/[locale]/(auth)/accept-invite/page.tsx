"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { api, ApiError, BASE_URL } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { Flame, Lock, User as UserIcon, Loader2 } from "lucide-react";

interface InvitationPreview {
  email: string;
  role: string;
  tenant_name: string;
  invited_by_name?: string | null;
  expires_at: string;
}

export default function AcceptInvitePage() {
  const t = useTranslations("team.accept");
  const tErrors = useTranslations("team.errors");
  const tRoles = useTranslations("team.roles");
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { login } = useAuthStore();

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState("");

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setPreviewError(t("invalidToken"));
      setLoadingPreview(false);
      return;
    }
    (async () => {
      try {
        const data = await api.get<InvitationPreview>(
          `/api/v1/team/invitations/preview?token=${encodeURIComponent(token)}`
        );
        setPreview(data);
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : t("invalidToken");
        setPreviewError(msg);
      } finally {
        setLoadingPreview(false);
      }
    })();
  }, [token, t]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError(tErrors("passwordsDontMatch"));
      return;
    }
    setSubmitting(true);
    try {
      const tokens = await api.post<{
        access_token: string;
        refresh_token: string;
      }>("/api/v1/team/invitations/accept", {
        token,
        password,
        full_name: fullName,
      });

      const user = await fetch(`${BASE_URL}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }).then((r) => r.json());
      const tenant = await fetch(`${BASE_URL}/api/v1/tenants/me`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }).then((r) => r.json());

      login(user, tenant, tokens.access_token, tokens.refresh_token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tErrors("failed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingPreview) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (previewError || !preview) {
    return (
      <div>
        <div className="mb-8 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Flame className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-secondary">Ignify</span>
        </div>
        <h2 className="text-2xl font-bold text-text-primary">{t("title")}</h2>
        <div className="mt-4 rounded-lg bg-error/10 px-4 py-3 text-sm text-error">
          {previewError || t("invalidToken")}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center gap-2 lg:hidden">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
          <Flame className="h-6 w-6 text-white" />
        </div>
        <span className="text-2xl font-bold text-secondary">Ignify</span>
      </div>

      <h2 className="text-2xl font-bold text-text-primary">{t("title")}</h2>
      <p className="mt-2 text-sm text-text-secondary">
        {t("welcomeTo")}{" "}
        <span className="font-semibold text-text-primary">
          {preview.tenant_name}
        </span>{" "}
        {" — "}
        {preview.email} ({tRoles(preview.role)})
      </p>
      <p className="mt-1 text-sm text-text-muted">{t("setPassword")}</p>

      {error && (
        <div className="mt-4 rounded-lg bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="mt-6 space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-primary">
            {t("fullName")}
          </label>
          <div className="relative">
            <UserIcon className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background py-2.5 ps-10 pe-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
              minLength={8}
              className="w-full rounded-lg border border-border bg-background py-2.5 ps-10 pe-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-primary">
            {t("confirmPassword")}
          </label>
          <div className="relative">
            <Lock className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border border-border bg-background py-2.5 ps-10 pe-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? t("accepting") : t("submit")}
        </button>
      </form>
    </div>
  );
}
