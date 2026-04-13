"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import {
  Loader2,
  Save,
  Instagram,
  Facebook,
  Youtube,
  Linkedin,
  Twitter,
  MessageCircle,
  Music2,
  Ghost,
  Mail,
  CheckCircle2,
  CircleDashed,
} from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";

const CHANNELS = [
  { id: "instagram", label: "Instagram", Icon: Instagram },
  { id: "whatsapp", label: "WhatsApp", Icon: MessageCircle },
  { id: "facebook", label: "Facebook", Icon: Facebook },
  { id: "tiktok", label: "TikTok", Icon: Music2 },
  { id: "twitter", label: "Twitter / X", Icon: Twitter },
  { id: "linkedin", label: "LinkedIn", Icon: Linkedin },
  { id: "youtube", label: "YouTube", Icon: Youtube },
  { id: "snapchat", label: "Snapchat", Icon: Ghost },
  { id: "email", label: "Email", Icon: Mail },
] as const;

interface SocialAccount {
  platform?: string;
  provider?: string;
}

export default function SettingsChannelsPage() {
  const t = useTranslations("settingsChannels");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [connected, setConnected] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const [channelsResp, accountsResp] = await Promise.all([
          api.get<{ channels: string[] }>("/api/v1/tenant-settings/channels"),
          api
            .get<SocialAccount[] | { accounts: SocialAccount[] }>("/api/v1/social/accounts")
            .catch(() => [] as SocialAccount[]),
        ]);
        setSelected(channelsResp.channels || []);
        const accts = Array.isArray(accountsResp) ? accountsResp : accountsResp.accounts ?? [];
        setConnected(new Set(accts.map((a) => (a.platform || a.provider || "").toLowerCase())));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = (id: string) =>
    setSelected((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put("/api/v1/tenant-settings/channels", { channels: selected });
      showToast(t("saved"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <DashboardHeader title={t("title")} />
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <DashboardHeader title={t("title")} />
      {toast && (
        <div className="fixed end-6 top-20 z-50 rounded-lg bg-success/90 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
      <div className="p-6">
        <form onSubmit={save} className="max-w-3xl space-y-5 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <p className="text-sm text-text-secondary">{t("subtitle")}</p>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {CHANNELS.map(({ id, label, Icon }) => {
              const active = selected.includes(id);
              const isConnected = connected.has(id);
              return (
                <button
                  type="button"
                  key={id}
                  onClick={() => toggle(id)}
                  className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition ${
                    active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-surface-hover"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-sm font-medium">{label}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-text-secondary">
                    {isConnected ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-success" /> {t("connected")}
                      </>
                    ) : (
                      <>
                        <CircleDashed className="h-3 w-3" /> {t("notConnected")}
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
