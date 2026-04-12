"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import Modal from "@/components/Modal";
import { api } from "@/lib/api";
import {
  MessageSquare,
  Instagram,
  Facebook,
  Mail,
  Slack,
  Camera,
  Youtube,
  Settings,
  Loader2,
  Plus,
} from "lucide-react";
import { clsx } from "clsx";

// ── Types ──────────────────────────────────────────────────────────────────

type ChannelType =
  | "whatsapp"
  | "messenger"
  | "instagram"
  | "email"
  | "slack"
  | "snapchat"
  | "youtube";

type ChannelStatus = "active" | "inactive" | "connecting";

interface ChannelResponse {
  id: string;
  tenant_id: string;
  type: ChannelType;
  name: string;
  config: Record<string, unknown> | null;
  status: ChannelStatus;
  created_at: string;
}

// ── Static maps ────────────────────────────────────────────────────────────

const CHANNEL_ICONS: Record<ChannelType, React.ElementType> = {
  whatsapp: MessageSquare,
  messenger: Facebook,
  instagram: Instagram,
  email: Mail,
  slack: Slack,
  snapchat: Camera,
  youtube: Youtube,
};

const CHANNEL_COLORS: Record<ChannelType, string> = {
  whatsapp: "bg-green-500/10 text-green-600",
  messenger: "bg-blue-600/10 text-blue-600",
  instagram: "bg-pink-500/10 text-pink-500",
  email: "bg-red-500/10 text-red-500",
  slack: "bg-purple-500/10 text-purple-600",
  snapchat: "bg-yellow-500/10 text-yellow-600",
  youtube: "bg-red-600/10 text-red-600",
};

const ALL_CHANNEL_TYPES: ChannelType[] = [
  "whatsapp",
  "messenger",
  "instagram",
  "email",
  "slack",
  "snapchat",
  "youtube",
];

// ── Component ──────────────────────────────────────────────────────────────

export default function ChannelsPage() {
  const t = useTranslations("channelsPage");
  const tc = useTranslations("common");

  const [channels, setChannels] = useState<ChannelResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Config modal state
  const [configOpen, setConfigOpen] = useState(false);
  const [configChannel, setConfigChannel] = useState<ChannelResponse | null>(null);
  const [configApiKey, setConfigApiKey] = useState("");
  const [configWebhook, setConfigWebhook] = useState("");
  const [configSaving, setConfigSaving] = useState(false);

  // Add channel modal state
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<ChannelType>("whatsapp");
  const [addName, setAddName] = useState("");
  const [addApiKey, setAddApiKey] = useState("");
  const [addWebhook, setAddWebhook] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // Disconnect state (keyed by channel id)
  const [disconnecting, setDisconnecting] = useState<Record<string, boolean>>({});

  // ── Data fetching ────────────────────────────────────────────────────────

  const fetchChannels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<ChannelResponse[]>("/api/v1/channels/");
      setChannels(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load channels");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const openConfig = (channel: ChannelResponse) => {
    setConfigChannel(channel);
    setConfigApiKey((channel.config?.api_key as string) ?? "");
    setConfigWebhook((channel.config?.webhook_url as string) ?? "");
    setConfigOpen(true);
  };

  const handleSaveConfig = async () => {
    if (!configChannel) return;
    setConfigSaving(true);
    try {
      const updated = await api.put<ChannelResponse>(
        `/api/v1/channels/${configChannel.id}`,
        {
          config: {
            ...configChannel.config,
            api_key: configApiKey,
            webhook_url: configWebhook,
          },
        }
      );
      setChannels((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      setConfigOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save config");
    } finally {
      setConfigSaving(false);
    }
  };

  const handleDisconnect = async (channel: ChannelResponse) => {
    setDisconnecting((prev) => ({ ...prev, [channel.id]: true }));
    try {
      await api.delete(`/api/v1/channels/${channel.id}`);
      setChannels((prev) => prev.filter((c) => c.id !== channel.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to disconnect channel");
    } finally {
      setDisconnecting((prev) => ({ ...prev, [channel.id]: false }));
    }
  };

  const handleAddChannel = async () => {
    if (!addName.trim()) return;
    setAddSaving(true);
    try {
      const created = await api.post<ChannelResponse>("/api/v1/channels/", {
        type: addType,
        name: addName.trim(),
        config: {
          api_key: addApiKey,
          webhook_url: addWebhook,
        },
      });
      setChannels((prev) => [created, ...prev]);
      setAddOpen(false);
      setAddName("");
      setAddApiKey("");
      setAddWebhook("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add channel");
    } finally {
      setAddSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        {/* Toolbar */}
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" />
            {t("addChannel")}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-xl border border-error/20 bg-error/5 p-6 text-center text-sm text-error">
            {error}
            <button
              onClick={fetchChannels}
              className="ms-3 underline hover:no-underline"
            >
              {tc("retry")}
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && channels.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MessageSquare className="h-12 w-12 text-text-muted/30" />
            <p className="mt-4 text-lg font-medium text-text-secondary">
              {t("noChannels")}
            </p>
            <p className="mt-1 text-sm text-text-muted">{t("noChannelsDesc")}</p>
          </div>
        )}

        {/* Channel grid */}
        {!loading && !error && channels.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {channels.map((channel) => {
              const Icon =
                CHANNEL_ICONS[channel.type] ?? MessageSquare;
              const colorClass =
                CHANNEL_COLORS[channel.type] ??
                "bg-text-muted/10 text-text-muted";
              const isActive = channel.status === "active";
              const isDisconnecting = disconnecting[channel.id] ?? false;

              return (
                <div
                  key={channel.id}
                  className="rounded-xl border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className={clsx("rounded-lg p-3", colorClass)}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <span
                      className={clsx(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                        isActive
                          ? "bg-success/10 text-success"
                          : "bg-text-muted/10 text-text-muted"
                      )}
                    >
                      {isActive ? tc("connected") : tc("disconnected")}
                    </span>
                  </div>

                  <h4 className="mt-4 text-sm font-semibold text-text-primary">
                    {channel.name}
                  </h4>
                  <p className="mt-1 text-xs text-text-muted capitalize">
                    {channel.type}
                  </p>

                  <div className="mt-4 flex gap-2">
                    {isActive ? (
                      <>
                        <button
                          onClick={() => openConfig(channel)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-hover"
                        >
                          <Settings className="h-3.5 w-3.5" />
                          {t("configure")}
                        </button>
                        <button
                          disabled={isDisconnecting}
                          onClick={() => handleDisconnect(channel)}
                          className="flex items-center justify-center gap-1 rounded-lg border border-error/20 px-3 py-1.5 text-xs font-medium text-error hover:bg-error/10 disabled:opacity-50"
                        >
                          {isDisconnecting ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            tc("disconnect")
                          )}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => openConfig(channel)}
                        className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark"
                      >
                        {tc("connect")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Config Modal */}
      <Modal
        open={configOpen}
        onOpenChange={setConfigOpen}
        title={
          configChannel
            ? `${configChannel.name} — ${t("configure")}`
            : t("configure")
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              API Key
            </label>
            <input
              type="text"
              value={configApiKey}
              onChange={(e) => setConfigApiKey(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Enter API key..."
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              Webhook URL
            </label>
            <input
              type="url"
              value={configWebhook}
              onChange={(e) => setConfigWebhook(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="https://..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfigOpen(false)}
              disabled={configSaving}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover disabled:opacity-50"
            >
              {tc("cancel")}
            </button>
            <button
              onClick={handleSaveConfig}
              disabled={configSaving}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {configSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {tc("save")}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Channel Modal */}
      <Modal
        open={addOpen}
        onOpenChange={setAddOpen}
        title={t("addChannel")}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("channelType")}
            </label>
            <select
              value={addType}
              onChange={(e) => setAddType(e.target.value as ChannelType)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {ALL_CHANNEL_TYPES.map((type) => (
                <option key={type} value={type} className="capitalize">
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("channelName")}
            </label>
            <input
              type="text"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={t("channelNamePlaceholder")}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              API Key
            </label>
            <input
              type="text"
              value={addApiKey}
              onChange={(e) => setAddApiKey(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Enter API key..."
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              Webhook URL
            </label>
            <input
              type="url"
              value={addWebhook}
              onChange={(e) => setAddWebhook(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="https://..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setAddOpen(false)}
              disabled={addSaving}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover disabled:opacity-50"
            >
              {tc("cancel")}
            </button>
            <button
              onClick={handleAddChannel}
              disabled={addSaving || !addName.trim()}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {addSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {tc("save")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
