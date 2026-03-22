"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import Modal from "@/components/Modal";
import { MessageSquare, Instagram, Facebook, Mail, Slack, Camera, Youtube, Settings } from "lucide-react";
import { clsx } from "clsx";

interface Channel {
  key: string;
  icon: React.ElementType;
  color: string;
  connected: boolean;
}

const channels: Channel[] = [
  { key: "whatsapp", icon: MessageSquare, color: "bg-green-500/10 text-green-600", connected: true },
  { key: "messenger", icon: Facebook, color: "bg-blue-600/10 text-blue-600", connected: true },
  { key: "instagram", icon: Instagram, color: "bg-pink-500/10 text-pink-500", connected: false },
  { key: "emailChannel", icon: Mail, color: "bg-red-500/10 text-red-500", connected: true },
  { key: "slack", icon: Slack, color: "bg-purple-500/10 text-purple-600", connected: false },
  { key: "snapchat", icon: Camera, color: "bg-yellow-500/10 text-yellow-600", connected: false },
  { key: "youtube", icon: Youtube, color: "bg-red-600/10 text-red-600", connected: true },
];

export default function ChannelsPage() {
  const t = useTranslations("channelsPage");
  const tc = useTranslations("common");
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);

  const openConfig = (channel: Channel) => {
    setSelectedChannel(channel);
    setConfigOpen(true);
  };

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {channels.map((channel) => {
            const Icon = channel.icon;
            return (
              <div
                key={channel.key}
                className="rounded-xl border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className={clsx("rounded-lg p-3", channel.color)}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <span
                    className={clsx(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium",
                      channel.connected
                        ? "bg-success/10 text-success"
                        : "bg-text-muted/10 text-text-muted"
                    )}
                  >
                    {channel.connected ? tc("connected") : tc("disconnected")}
                  </span>
                </div>

                <h4 className="mt-4 text-sm font-semibold text-text-primary">
                  {t(channel.key as "whatsapp" | "messenger" | "instagram" | "emailChannel" | "slack" | "snapchat" | "youtube")}
                </h4>
                <p className="mt-1 text-xs text-text-muted">{t("channelStatus")}</p>

                <div className="mt-4 flex gap-2">
                  {channel.connected ? (
                    <>
                      <button
                        onClick={() => openConfig(channel)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-hover"
                      >
                        <Settings className="h-3.5 w-3.5" />
                        {t("configure")}
                      </button>
                      <button className="rounded-lg border border-error/20 px-3 py-1.5 text-xs font-medium text-error hover:bg-error/10">
                        {tc("disconnect")}
                      </button>
                    </>
                  ) : (
                    <button className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark">
                      {tc("connect")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal
        open={configOpen}
        onOpenChange={setConfigOpen}
        title={selectedChannel ? t(selectedChannel.key as "whatsapp") + " " + t("configure") : t("configure")}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">API Key</label>
            <input type="text" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Enter API key..." />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Webhook URL</label>
            <input type="url" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" placeholder="https://..." />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setConfigOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover">
              {tc("cancel")}
            </button>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
              {tc("save")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
