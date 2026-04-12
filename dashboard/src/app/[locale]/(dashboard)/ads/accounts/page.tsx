"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Loader2, RefreshCw, Link as LinkIcon } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";

interface AdAccount {
  id: string;
  platform: string;
  account_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export default function AdsAccountsPage() {
  const t = useTranslations("ads");
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<AdAccount[]>("/api/v1/ads/accounts");
      setAccounts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }

  async function sync() {
    setSyncing(true);
    setError(null);
    try {
      const data = await api.post<AdAccount[]>("/api/v1/ads/accounts/sync", {});
      setAccounts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <DashboardHeader title={t("accountsTitle")} />
      <div className="p-6">
        {error && (
          <div className="mb-4 rounded-lg bg-error/10 px-4 py-2 text-sm text-error">{error}</div>
        )}

        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-text-muted">{t("accountsSubtitle")}</p>
          <button
            onClick={sync}
            disabled={syncing}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {t("syncAccounts")}
          </button>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-10 text-center">
            <LinkIcon className="mx-auto mb-3 h-8 w-8 text-text-muted" />
            <p className="text-sm text-text-muted">{t("noAccounts")}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((a) => (
              <div key={a.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                <p className="text-sm font-medium text-text-primary">{a.name}</p>
                <p className="text-xs capitalize text-text-muted">{a.platform.replace(/_/g, " ")}</p>
                <p className="mt-1 text-xs text-text-muted">{a.account_id}</p>
                <span className={`mt-2 inline-block text-xs ${a.is_active ? "text-success" : "text-text-muted"}`}>
                  {a.is_active ? t("active") : t("inactive")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
