"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import { clsx } from "clsx";
import { api } from "@/lib/api";

interface GlobalSettings {
  openrouter_api_key_set: boolean;
  openrouter_base_url: string;
  replicate_token_set: boolean;
  elevenlabs_key_set: boolean;
  stripe_key_set: boolean;
  paymob_configured: boolean;
  paytabs_configured: boolean;
  geidea_configured: boolean;
  email_verification_required?: boolean;
}

export default function AdminSettingsPage() {
  const t = useTranslations("adminSettings");
  const tAuth = useTranslations("adminSettings.auth");
  const [data, setData] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<GlobalSettings>("/api/v1/admin/settings")
      .then(setData)
      .catch((e) => setError(e?.message ?? "Failed"))
      .finally(() => setLoading(false));
  }, []);

  const rows: { key: keyof GlobalSettings; labelKey: string }[] = [
    { key: "openrouter_api_key_set", labelKey: "openrouter" },
    { key: "replicate_token_set", labelKey: "replicate" },
    { key: "elevenlabs_key_set", labelKey: "elevenlabs" },
    { key: "stripe_key_set", labelKey: "stripe" },
    { key: "paymob_configured", labelKey: "paymob" },
    { key: "paytabs_configured", labelKey: "paytabs" },
    { key: "geidea_configured", labelKey: "geidea" },
  ];

  return (
    <div>
      <div className="sticky top-0 z-30 flex h-16 items-center border-b border-border bg-surface px-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">{t("title")}</h1>
          <p className="text-xs text-text-muted">{t("subtitle")}</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-warning" />
          <div className="text-sm">
            <p className="font-semibold text-warning">{t("warning.readOnly")}</p>
            <p className="mt-1 text-text-secondary">{t("warning.envManaged")}</p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : data ? (
          <div className="rounded-xl border border-border bg-surface">
            <ul className="divide-y divide-border">
              {rows.map(({ key, labelKey }) => {
                const configured = Boolean(data[key]);
                return (
                  <li
                    key={key}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <span className="text-sm font-medium text-text-primary">
                      {t(`providers.${labelKey}`)}
                    </span>
                    <span className="flex items-center gap-2 text-sm">
                      <span
                        className={clsx(
                          "h-2.5 w-2.5 rounded-full",
                          configured ? "bg-success" : "bg-error"
                        )}
                      />
                      <span
                        className={clsx(
                          "text-xs",
                          configured ? "text-success" : "text-error"
                        )}
                      >
                        {configured
                          ? t("providers.configured")
                          : t("providers.notConfigured")}
                      </span>
                    </span>
                  </li>
                );
              })}
              <li className="flex items-center justify-between px-5 py-3 text-xs text-text-muted">
                <span>OpenRouter Base URL</span>
                <span className="font-mono">{data.openrouter_base_url}</span>
              </li>
            </ul>
          </div>
        ) : null}

        {data && (
          <div className="rounded-xl border border-border bg-surface">
            <div className="border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold text-text-primary">
                {tAuth("title")}
              </h2>
            </div>
            <ul className="divide-y divide-border">
              <li className="flex items-center justify-between px-5 py-3">
                <span className="text-sm font-medium text-text-primary">
                  {tAuth("emailVerificationLabel")}
                </span>
                <span className="flex items-center gap-2 text-sm">
                  <span
                    className={clsx(
                      "h-2.5 w-2.5 rounded-full",
                      data.email_verification_required
                        ? "bg-success"
                        : "bg-text-muted"
                    )}
                  />
                  <span
                    className={clsx(
                      "text-xs font-semibold",
                      data.email_verification_required
                        ? "text-success"
                        : "text-text-muted"
                    )}
                  >
                    {data.email_verification_required
                      ? tAuth("emailVerificationOn")
                      : tAuth("emailVerificationOff")}
                  </span>
                </span>
              </li>
              <li className="px-5 py-2 text-xs text-text-muted">
                {tAuth("envManaged")}
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
