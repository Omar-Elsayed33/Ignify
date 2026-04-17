"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import { api } from "@/lib/api";
import {
  Facebook,
  Ghost,
  Instagram,
  Linkedin,
  Loader2,
  Music2,
  Plug,
  Trash2,
  Twitter,
  Youtube,
} from "lucide-react";
import { clsx } from "clsx";

interface ConnectedAccount {
  id: string;
  platform: string;
  page_name: string;
  page_id: string;
  connected_at: string;
  expires_at: string | null;
}

interface ConnectorInfo {
  platform: string;
  configured: boolean;
  requires_media: boolean;
  supports_refresh: boolean;
}

// Platform → which OAuth route to start. Meta covers Facebook + Instagram in one grant.
const OAUTH_ROUTE: Record<string, string> = {
  facebook: "meta",
  instagram: "meta",
  linkedin: "linkedin",
  twitter: "x",
  youtube: "youtube",
  tiktok: "tiktok",
  snapchat: "snapchat",
};

const PLATFORM_META: Record<
  string,
  { label: string; Icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  facebook: { label: "Facebook", Icon: Facebook, color: "bg-blue-600/10 text-blue-600" },
  instagram: { label: "Instagram", Icon: Instagram, color: "bg-pink-500/10 text-pink-500" },
  linkedin: { label: "LinkedIn", Icon: Linkedin, color: "bg-sky-700/10 text-sky-700" },
  twitter: { label: "X (Twitter)", Icon: Twitter, color: "bg-neutral-800/10 text-neutral-800" },
  youtube: { label: "YouTube", Icon: Youtube, color: "bg-red-600/10 text-red-600" },
  tiktok: { label: "TikTok", Icon: Music2, color: "bg-rose-500/10 text-rose-500" },
  snapchat: { label: "Snapchat", Icon: Ghost, color: "bg-yellow-400/10 text-yellow-600" },
};

export default function SchedulerAccountsPage() {
  const t = useTranslations("scheduler");
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [accs, conns] = await Promise.all([
        api.get<ConnectedAccount[]>("/api/v1/social-scheduler/accounts"),
        api.get<{ connectors: ConnectorInfo[] }>("/api/v1/social-scheduler/connectors"),
      ]);
      setAccounts(accs);
      setConnectors(conns.connectors || []);
    } catch {
      setAccounts([]);
      setConnectors([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleConnect(platform: string) {
    setConnectingPlatform(platform);
    setError(null);
    try {
      const route = OAUTH_ROUTE[platform] || platform;
      const res = await api.get<{ url: string; state: string }>(
        `/api/v1/social-scheduler/oauth/${route}/start`
      );
      window.open(res.url, "_blank", "noopener,noreferrer");
    } catch {
      setError(t("errors.oauthFailed"));
    } finally {
      setConnectingPlatform(null);
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

  const visibleConnectors = connectors.filter((c) => c.platform !== "instagram");
  const connectedByPlatform = new Set(accounts.map((a) => a.platform));

  return (
    <div>
      <DashboardHeader title={t("accounts.title")} />
      <div className="space-y-8 p-6">
        {error && (
          <div className="rounded-lg bg-error/10 px-4 py-2.5 text-sm text-error">
            {error}
          </div>
        )}

        <section>
          <h2 className="mb-4 text-lg font-semibold text-text-primary">
            {t("accounts.platforms") ?? "المنصات"}
          </h2>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {visibleConnectors.map((c) => {
                const meta = PLATFORM_META[c.platform];
                if (!meta) return null;
                const isConnected = connectedByPlatform.has(c.platform);
                const Icon = meta.Icon;
                return (
                  <div
                    key={c.platform}
                    className="flex items-start justify-between rounded-xl border border-border bg-surface p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className={clsx("rounded-lg p-2", meta.color)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{meta.label}</p>
                        <p className="mt-0.5 text-xs text-text-muted">
                          {isConnected
                            ? t("accounts.connected") ?? "متصل"
                            : c.configured
                            ? t("accounts.readyToConnect") ?? "جاهز للربط"
                            : t("accounts.notConfigured") ?? "غير مُعدّ على الخادم"}
                        </p>
                      </div>
                    </div>
                    <button
                      disabled={!c.configured || connectingPlatform === c.platform}
                      onClick={() => handleConnect(c.platform)}
                      className={clsx(
                        "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                        !c.configured
                          ? "cursor-not-allowed bg-surface-container text-text-muted opacity-50"
                          : isConnected
                          ? "bg-surface-container text-text-secondary hover:bg-surface-hover"
                          : "bg-primary text-white hover:bg-primary-dark"
                      )}
                      title={
                        !c.configured
                          ? t("accounts.notConfiguredHint") ??
                            "أضف OAuth credentials في ملف .env"
                          : undefined
                      }
                    >
                      {connectingPlatform === c.platform ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isConnected ? (
                        t("accounts.reconnect") ?? "إعادة الربط"
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Plug className="h-3.5 w-3.5" /> {t("accounts.connect") ?? "ربط"}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-text-primary">
            {t("accounts.connected") ?? "الحسابات المتصلة"}
          </h2>
          {loading ? null : accounts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-10 text-center">
              <p className="text-sm text-text-muted">{t("accounts.noAccounts")}</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {accounts.map((a) => {
                const meta = PLATFORM_META[a.platform] ?? {
                  label: a.platform,
                  Icon: Plug,
                  color: "bg-text-muted/10 text-text-muted",
                };
                const Icon = meta.Icon;
                return (
                  <div
                    key={a.id}
                    className="rounded-xl border border-border bg-surface p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className={clsx("rounded-lg p-2", meta.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text-primary">
                            {a.page_name}
                          </p>
                          <p className="truncate text-xs text-text-muted">
                            {meta.label} · {a.page_id}
                          </p>
                          {a.expires_at && (
                            <p className="mt-1 text-xs text-text-muted">
                              {t("accounts.expiresOn")}:{" "}
                              {new Date(a.expires_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
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
        </section>
      </div>
    </div>
  );
}
