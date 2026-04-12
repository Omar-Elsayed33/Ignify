"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import { api } from "@/lib/api";
import { clsx } from "clsx";
import {
  MonitorSmartphone,
  BarChart3,
  Search,
  Mail,
  ShoppingBag,
  Globe,
  Zap,
  Users,
  Loader2,
  AlertCircle,
  Plus,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type IntegrationStatus = "connected" | "disconnected" | "error" | "pending";

interface Integration {
  id: string;
  tenant_id: string;
  platform: string;
  status: IntegrationStatus;
  config: Record<string, unknown> | null;
  created_at: string;
}

// ── Static catalog of known platforms ────────────────────────────────────────
// Visual metadata only — connection state always comes from the API.

interface PlatformMeta {
  icon: React.ElementType;
  color: string;
}

const PLATFORM_META: Record<string, PlatformMeta> = {
  google_ads:        { icon: MonitorSmartphone, color: "bg-blue-500/10 text-blue-500" },
  meta_ads:          { icon: MonitorSmartphone, color: "bg-blue-600/10 text-blue-600" },
  snapchat_ads:      { icon: MonitorSmartphone, color: "bg-yellow-500/10 text-yellow-500" },
  google_analytics:  { icon: BarChart3,         color: "bg-orange-500/10 text-orange-500" },
  search_console:    { icon: Search,            color: "bg-green-500/10 text-green-500" },
  mailchimp:         { icon: Mail,              color: "bg-yellow-600/10 text-yellow-600" },
  hubspot:           { icon: Users,             color: "bg-orange-600/10 text-orange-600" },
  shopify:           { icon: ShoppingBag,       color: "bg-green-600/10 text-green-600" },
  wordpress:         { icon: Globe,             color: "bg-sky-500/10 text-sky-500" },
  zapier:            { icon: Zap,               color: "bg-orange-500/10 text-orange-500" },
};

// Platforms available to connect but not yet in the user's integration list
const ALL_PLATFORMS = Object.keys(PLATFORM_META);

function getPlatformMeta(platform: string): PlatformMeta {
  return (
    PLATFORM_META[platform] ?? {
      icon: Globe,
      color: "bg-text-muted/10 text-text-muted",
    }
  );
}

// ── Integration Card ─────────────────────────────────────────────────────────

interface IntegrationCardProps {
  integration: Integration;
  onDisconnect: (id: string) => Promise<void>;
  disconnecting: boolean;
  t: ReturnType<typeof useTranslations>;
  tc: ReturnType<typeof useTranslations>;
}

function IntegrationCard({ integration, onDisconnect, disconnecting, t, tc }: IntegrationCardProps) {
  const meta = getPlatformMeta(integration.platform);
  const Icon = meta.icon;
  const isConnected = integration.status === "connected";

  // Try translation key; fall back to raw platform string
  let displayName: string;
  try {
    displayName = t(integration.platform as "googleAds");
  } catch {
    displayName = integration.platform
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={clsx("rounded-lg p-2.5", meta.color)}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-text-primary">{displayName}</h4>
            <span
              className={clsx(
                "text-xs font-medium",
                isConnected ? "text-success" : "text-text-muted"
              )}
            >
              {isConnected ? tc("connected") : tc("disconnected")}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4">
        {isConnected ? (
          <button
            onClick={() => onDisconnect(integration.id)}
            disabled={disconnecting}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-error/20 py-2 text-xs font-medium text-error hover:bg-error/10 disabled:opacity-50"
          >
            {disconnecting && <Loader2 className="h-3 w-3 animate-spin" />}
            {tc("disconnect")}
          </button>
        ) : (
          <div className="flex w-full items-center justify-center gap-1 rounded-lg border border-border py-2 text-xs text-text-muted">
            {tc("disconnected")}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Connect Modal ────────────────────────────────────────────────────────────

interface ConnectModalProps {
  existingPlatforms: string[];
  onClose: () => void;
  onConnected: (integration: Integration) => void;
  t: ReturnType<typeof useTranslations>;
  tc: ReturnType<typeof useTranslations>;
}

function ConnectModal({ existingPlatforms, onClose, onConnected, t, tc }: ConnectModalProps) {
  const available = ALL_PLATFORMS.filter((p) => !existingPlatforms.includes(p));
  const [platform, setPlatform] = useState(available[0] ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!platform) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<Integration>("/api/v1/integrations/connect", {
        platform,
        config: {},
      });
      onConnected(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorConnect"));
    } finally {
      setSubmitting(false);
    }
  }

  function displayName(p: string) {
    return p.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="mb-4 text-base font-semibold text-text-primary">{t("connectNew")}</h2>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {available.length === 0 ? (
          <p className="text-sm text-text-secondary">{t("allConnected")}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">
                {t("platform")}
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {available.map((p) => (
                  <option key={p} value={p}>
                    {displayName(p)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
              >
                {tc("cancel")}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {tc("connect")}
              </button>
            </div>
          </form>
        )}

        {available.length === 0 && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
            >
              {tc("close")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const t = useTranslations("integrationsPage");
  const tc = useTranslations("common");

  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [connectOpen, setConnectOpen] = useState(false);

  const fetchIntegrations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Integration[]>("/api/v1/integrations/");
      setIntegrations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  async function handleDisconnect(id: string) {
    setDisconnectingId(id);
    setActionError(null);
    try {
      const updated = await api.post<Integration>(`/api/v1/integrations/${id}/disconnect`);
      setIntegrations((prev) =>
        prev.map((i) => (i.id === id ? updated : i))
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("errorDisconnect"));
    } finally {
      setDisconnectingId(null);
    }
  }

  function handleConnected(integration: Integration) {
    setIntegrations((prev) => {
      const exists = prev.find((i) => i.id === integration.id);
      if (exists) {
        return prev.map((i) => (i.id === integration.id ? integration : i));
      }
      return [integration, ...prev];
    });
    setConnectOpen(false);
  }

  const existingPlatforms = integrations.map((i) => i.platform);

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        {/* Header actions */}
        <div className="mb-6 flex items-center justify-end">
          <button
            onClick={() => setConnectOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" />
            {t("connectNew")}
          </button>
        </div>

        {/* Action error banner */}
        {actionError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {actionError}
            <button
              className="ms-auto text-xs underline"
              onClick={() => setActionError(null)}
            >
              {tc("dismiss")}
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-xl border border-border bg-surface"
              />
            ))}
          </div>
        )}

        {/* Fetch error */}
        {!loading && error && (
          <div className="flex items-center gap-2 rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && integrations.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-surface p-16 text-center">
            <Zap className="mx-auto h-10 w-10 text-text-muted/40" />
            <p className="mt-3 text-sm font-medium text-text-secondary">{t("emptyTitle")}</p>
            <p className="mt-1 text-xs text-text-muted">{t("emptyDescription")}</p>
            <button
              onClick={() => setConnectOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
            >
              <Plus className="h-4 w-4" />
              {t("connectNew")}
            </button>
          </div>
        )}

        {/* Integration cards */}
        {!loading && integrations.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {integrations.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                onDisconnect={handleDisconnect}
                disconnecting={disconnectingId === integration.id}
                t={t}
                tc={tc}
              />
            ))}
          </div>
        )}
      </div>

      {/* Connect modal */}
      {connectOpen && (
        <ConnectModal
          existingPlatforms={existingPlatforms}
          onClose={() => setConnectOpen(false)}
          onConnected={handleConnected}
          t={t}
          tc={tc}
        />
      )}
    </div>
  );
}
