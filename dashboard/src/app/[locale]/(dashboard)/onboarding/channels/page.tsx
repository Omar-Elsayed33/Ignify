"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import {
  Loader2,
  Instagram,
  Facebook,
  Youtube,
  Linkedin,
  Twitter,
  MessageCircle,
  Music2,
  Ghost,
  Mail,
} from "lucide-react";

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

export default function ChannelsPage() {
  const t = useTranslations("onboarding");
  const router = useRouter();

  const [selected, setSelected] = useState<string[]>(["instagram", "whatsapp"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSelected((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post("/api/v1/onboarding/channels", { channels: selected });
      router.push("/onboarding/plan");
    } catch {
      setError(t("errors.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-text-primary">{t("channels.title")}</h2>
        <p className="mt-1 text-sm text-text-secondary">{t("channels.subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {CHANNELS.map(({ id, label, Icon }) => {
          const active = selected.includes(id);
          return (
            <button
              type="button"
              key={id}
              onClick={() => toggle(id)}
              className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background hover:bg-surface-hover"
              }`}
            >
              <Icon className="h-6 w-6" />
              <span className="text-sm font-medium">{label}</span>
            </button>
          );
        })}
      </div>

      {error && <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</div>}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={() => router.push("/onboarding/brand")}
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-hover"
        >
          {t("channels.previous")}
        </button>
        <button
          type="submit"
          disabled={loading || selected.length === 0}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("channels.next")}
        </button>
      </div>
    </form>
  );
}
