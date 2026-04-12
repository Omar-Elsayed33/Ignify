"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import DashboardHeader from "@/components/DashboardHeader";
import { api } from "@/lib/api";
import { Loader2, AlertCircle, Save, Sparkles, CheckCircle2 } from "lucide-react";

interface WhiteLabelSettings {
  white_label_enabled: boolean;
  custom_domain: string | null;
  custom_domain_verified: boolean;
  app_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  colors: Record<string, string> | null;
  email_sender_name: string | null;
  email_sender_address: string | null;
  footer_text: string | null;
  support_email: string | null;
  support_url: string | null;
  hide_powered_by: boolean;
  plan_code: string | null;
  is_agency: boolean;
}

export default function WhiteLabelPage() {
  const t = useTranslations("whiteLabel");
  const router = useRouter();

  const [data, setData] = useState<WhiteLabelSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<WhiteLabelSettings>("/api/v1/white-label/settings");
        setData(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function updateField<K extends keyof WhiteLabelSettings>(k: K, v: WhiteLabelSettings[K]) {
    if (!data) return;
    setData({ ...data, [k]: v });
  }

  function updateColor(key: string, value: string) {
    if (!data) return;
    const next = { ...(data.colors || {}), [key]: value };
    setData({ ...data, colors: next });
  }

  async function save() {
    if (!data) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const body = {
        white_label_enabled: data.white_label_enabled,
        custom_domain: data.custom_domain,
        app_name: data.app_name,
        logo_url: data.logo_url,
        favicon_url: data.favicon_url,
        colors: data.colors,
        email_sender_name: data.email_sender_name,
        email_sender_address: data.email_sender_address,
        footer_text: data.footer_text,
        support_email: data.support_email,
        support_url: data.support_url,
        hide_powered_by: data.hide_powered_by,
      };
      const updated = await api.put<WhiteLabelSettings>("/api/v1/white-label/settings", body);
      setData(updated);
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function verifyDomain() {
    if (!data?.custom_domain) return;
    setVerifying(true);
    try {
      await api.post("/api/v1/white-label/custom-domain/verify", { domain: data.custom_domain });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verify failed");
    } finally {
      setVerifying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error">
          {error}
        </div>
      </div>
    );
  }

  // Gating: non-Agency upsell
  if (!data.is_agency) {
    return (
      <div>
        <DashboardHeader title={t("title")} />
        <div className="mx-auto max-w-2xl p-6">
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-amber-500/10 p-8 text-center">
            <Sparkles className="mx-auto mb-4 h-12 w-12 text-primary" />
            <h2 className="mb-2 text-xl font-bold">{t("upgrade.title")}</h2>
            <p className="mb-6 text-sm text-text-secondary">{t("upgrade.description")}</p>
            <button
              onClick={() => router.push("/billing/plans")}
              className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              {t("upgrade.button")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <DashboardHeader title={t("title")} />
      <div className="mx-auto max-w-4xl p-6">
        <p className="mb-4 text-sm text-text-secondary">{t("subtitle")}</p>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-4 py-2 text-sm text-error">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            {t("saved")}
          </div>
        )}

        <div className="space-y-5">
          <section className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-semibold">{t("section.branding")}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t("form.appName")}>
                <input
                  value={data.app_name || ""}
                  onChange={(e) => updateField("app_name", e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field label={t("form.logoUrl")}>
                <input
                  value={data.logo_url || ""}
                  onChange={(e) => updateField("logo_url", e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field label={t("form.faviconUrl")}>
                <input
                  value={data.favicon_url || ""}
                  onChange={(e) => updateField("favicon_url", e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field label={t("form.primaryColor")}>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={data.colors?.primary || "#F97316"}
                    onChange={(e) => updateColor("primary", e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded border border-border"
                  />
                  <input
                    value={data.colors?.primary || ""}
                    onChange={(e) => updateColor("primary", e.target.value)}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </Field>
              <Field label={t("form.secondaryColor")}>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={data.colors?.secondary || "#1E293B"}
                    onChange={(e) => updateColor("secondary", e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded border border-border"
                  />
                  <input
                    value={data.colors?.secondary || ""}
                    onChange={(e) => updateColor("secondary", e.target.value)}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </Field>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-semibold">{t("section.domain")}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t("form.customDomain")}>
                <input
                  placeholder="app.example.com"
                  value={data.custom_domain || ""}
                  onChange={(e) => updateField("custom_domain", e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
              <div className="flex items-end gap-2">
                <button
                  onClick={verifyDomain}
                  disabled={!data.custom_domain || verifying}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-hover disabled:opacity-60"
                >
                  {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : t("form.verifyDomain")}
                </button>
                {data.custom_domain_verified ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    {t("form.verified")}
                  </span>
                ) : data.custom_domain ? (
                  <span className="text-xs text-amber-600">{t("form.pending")}</span>
                ) : null}
              </div>
            </div>
            <p className="mt-2 text-xs text-text-muted">{t("form.dnsHint")}</p>
          </section>

          <section className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-semibold">{t("section.email")}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t("form.senderName")}>
                <input
                  value={data.email_sender_name || ""}
                  onChange={(e) => updateField("email_sender_name", e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field label={t("form.senderAddress")}>
                <input
                  value={data.email_sender_address || ""}
                  onChange={(e) => updateField("email_sender_address", e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field label={t("form.supportEmail")}>
                <input
                  value={data.support_email || ""}
                  onChange={(e) => updateField("support_email", e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field label={t("form.supportUrl")}>
                <input
                  value={data.support_url || ""}
                  onChange={(e) => updateField("support_url", e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-semibold">{t("section.footer")}</h3>
            <Field label={t("form.footerText")}>
              <textarea
                rows={2}
                value={data.footer_text || ""}
                onChange={(e) => updateField("footer_text", e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </Field>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={data.hide_powered_by}
                onChange={(e) => updateField("hide_powered_by", e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              {t("form.hidePoweredBy")}
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={data.white_label_enabled}
                onChange={(e) => updateField("white_label_enabled", e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              {t("form.enableWhiteLabel")}
            </label>
          </section>

          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 rounded-md bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t("form.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium">{label}</label>
      {children}
    </div>
  );
}
