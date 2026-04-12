"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import { api } from "@/lib/api";
import { Loader2, Plug, Trash2 } from "lucide-react";
import { clsx } from "clsx";

interface ConnectedAccount {
  id: string;
  platform: string;
  page_name: string;
  page_id: string;
  connected_at: string;
  expires_at: string | null;
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-500/10 text-pink-500",
  facebook: "bg-blue-600/10 text-blue-600",
};

export default function SchedulerAccountsPage() {
  const t = useTranslations("scheduler");
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<ConnectedAccount[]>(
        "/api/v1/social-scheduler/accounts"
      );
      setAccounts(res);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      const res = await api.get<{ url: string; state: string }>(
        "/api/v1/social-scheduler/oauth/meta/start"
      );
      window.open(res.url, "_blank", "noopener,noreferrer");
    } catch {
      setError(t("errors.oauthFailed"));
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect(id: string) {
    setRemovingId(id);
    try {
      await api.delete(`/api/v1/social-scheduler/accounts/${id}`);
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setError(t("errors.failed"));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div>
      <DashboardHeader title={t("accounts.title")} />
      <div className="p-6">
        {error && (
          <div className="mb-4 rounded-lg bg-error/10 px-4 py-2.5 text-sm text-error">
            {error}
          </div>
        )}

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">
            {t("accounts.connected")}
          </h2>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {connecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plug className="h-4 w-4" />
            )}
            {t("accounts.connectMeta")}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-text-muted">{t("accounts.noAccounts")}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {accounts.map((a) => {
              const color =
                PLATFORM_COLORS[a.platform] ??
                "bg-text-muted/10 text-text-muted";
              return (
                <div
                  key={a.id}
                  className="rounded-xl border border-border bg-surface p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          className={clsx(
                            "rounded-full px-2 py-0.5 text-xs font-semibold capitalize",
                            color
                          )}
                        >
                          {a.platform}
                        </span>
                      </div>
                      <p className="truncate text-sm font-medium text-text-primary">
                        {a.page_name}
                      </p>
                      <p className="truncate text-xs text-text-muted">
                        {a.page_id}
                      </p>
                      {a.expires_at && (
                        <p className="mt-1 text-xs text-text-muted">
                          {t("accounts.expiresOn")}:{" "}
                          {new Date(a.expires_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDisconnect(a.id)}
                      disabled={removingId === a.id}
                      className="rounded-lg p-1.5 text-text-muted hover:bg-error/10 hover:text-error disabled:opacity-40"
                      title={t("accounts.disconnect")}
                    >
                      {removingId === a.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
