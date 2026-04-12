"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import { api } from "@/lib/api";
import {
  Save,
  Loader2,
  Sparkles,
  Building2,
  Users,
  Share2,
  Palette,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { Link } from "@/i18n/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TenantConfig {
  business_name?: string;
  industry?: string;
  description?: string;
  website?: string;
  phone?: string;
  business_email?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  linkedin?: string;
  tiktok?: string;
  youtube?: string;
  snapchat?: string;
  target_demographics?: string;
  target_locations?: string;
  target_interests?: string;
  brand_voice?: string;
  brand_tone?: string;
  brand_colors?: string;
  [key: string]: unknown;
}

interface Tenant {
  id: string;
  name: string;
  config: TenantConfig | null;
}

interface AIMessage {
  role: string;
  content: string;
}

interface AIResponse {
  message: AIMessage;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="mb-1.5 block text-sm font-medium text-text-primary">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const t = useTranslations("profilePage");
  const tc = useTranslations("common");

  // Form state
  const [config, setConfig] = useState<TenantConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // AI state
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // ── Load tenant data ────────────────────────────────────────────────────────

  const loadTenant = useCallback(async () => {
    setLoading(true);
    try {
      const tenant = await api.get<Tenant>("/api/v1/tenants/me");
      setConfig(tenant.config ?? {});
    } catch {
      // silently fail, start with empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTenant();
  }, [loadTenant]);

  // ── Field change helper ─────────────────────────────────────────────────────

  function set(field: keyof TenantConfig, value: string) {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await api.put("/api/v1/tenants/me", { config });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("errorSave"));
    } finally {
      setSaving(false);
    }
  }

  // ── AI Generate ─────────────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!config.business_name && !config.industry) return;
    setAiGenerating(true);
    setAiError(null);
    setAiResponse(null);
    try {
      const businessName = config.business_name || t("yourBusiness");
      const industry = config.industry || t("yourIndustry");
      const message = `Based on my business name '${businessName}' in the '${industry}' industry, generate a complete business profile including: a compelling description, target audience suggestions, brand voice recommendation, and social media strategy suggestions. Format as structured sections.`;
      const res = await api.post<AIResponse>("/api/v1/assistant/chat", {
        message,
      });
      setAiResponse(res.message?.content ?? String(res));
    } catch (err) {
      setAiError(err instanceof Error ? err.message : t("errorAI"));
    } finally {
      setAiGenerating(false);
    }
  }

  // ── Auto-fill from AI response ──────────────────────────────────────────────

  function autoFillFromAI() {
    if (!aiResponse) return;
    // Extract description heuristic: first paragraph after "Description" heading
    const descMatch = aiResponse.match(
      /(?:description|about)[:\s\n]+([^\n#*]{30,})/i
    );
    if (descMatch) set("description", descMatch[1].trim());

    // Extract brand voice
    const voiceMatch = aiResponse.match(
      /brand\s*voice[:\s\n]+([^\n#*]{5,60})/i
    );
    if (voiceMatch) set("brand_voice", voiceMatch[1].trim());

    // Extract brand tone
    const toneMatch = aiResponse.match(
      /brand\s*tone[:\s\n]+([^\n#*]{5,60})/i
    );
    if (toneMatch) set("brand_tone", toneMatch[1].trim());

    // Extract target audience
    const audienceMatch = aiResponse.match(
      /target\s*audience[:\s\n]+([^\n#*]{10,120})/i
    );
    if (audienceMatch) set("target_demographics", audienceMatch[1].trim());
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div>
        <DashboardHeader title={t("title")} />
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        {/* Top action bar */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-text-muted">{t("subtitle")}</p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? t("saving") : saveSuccess ? t("saved") : t("saveProfile")}
          </button>
        </div>

        {/* Save error */}
        {saveError && (
          <div className="mb-5 flex items-center gap-2 rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {saveError}
            <button
              className="ms-auto text-xs underline"
              onClick={() => setSaveError(null)}
            >
              {tc("close")}
            </button>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-3">
          {/* Left column (2/3 width) */}
          <div className="space-y-6 xl:col-span-2">

            {/* ── Business Info ─────────────────────────────────────────────── */}
            <SectionCard icon={Building2} title={t("businessInfo")}>
              <FieldGroup>
                <Field label={t("businessName")}>
                  <input
                    type="text"
                    value={config.business_name ?? ""}
                    onChange={(e) => set("business_name", e.target.value)}
                    placeholder={t("businessNamePlaceholder")}
                    className={inputClass}
                  />
                </Field>
                <Field label={t("industry")}>
                  <input
                    type="text"
                    value={config.industry ?? ""}
                    onChange={(e) => set("industry", e.target.value)}
                    placeholder={t("industryPlaceholder")}
                    className={inputClass}
                  />
                </Field>
                <Field label={t("description")} full>
                  <textarea
                    value={config.description ?? ""}
                    onChange={(e) => set("description", e.target.value)}
                    placeholder={t("descriptionPlaceholder")}
                    rows={3}
                    className={inputClass}
                  />
                </Field>
                <Field label={t("website")}>
                  <input
                    type="url"
                    value={config.website ?? ""}
                    onChange={(e) => set("website", e.target.value)}
                    placeholder="https://"
                    className={inputClass}
                  />
                </Field>
                <Field label={t("phone")}>
                  <input
                    type="tel"
                    value={config.phone ?? ""}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="+1 555 000 0000"
                    className={inputClass}
                  />
                </Field>
                <Field label={t("businessEmail")}>
                  <input
                    type="email"
                    value={config.business_email ?? ""}
                    onChange={(e) => set("business_email", e.target.value)}
                    placeholder="hello@yourbusiness.com"
                    className={inputClass}
                  />
                </Field>
              </FieldGroup>
            </SectionCard>

            {/* ── Social Media Profiles ─────────────────────────────────────── */}
            <SectionCard icon={Share2} title={t("socialProfiles")}>
              <FieldGroup>
                {(
                  [
                    { field: "instagram", label: "Instagram", placeholder: "https://instagram.com/handle" },
                    { field: "facebook", label: "Facebook", placeholder: "https://facebook.com/page" },
                    { field: "twitter", label: "Twitter / X", placeholder: "https://x.com/handle" },
                    { field: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/company/name" },
                    { field: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@handle" },
                    { field: "youtube", label: "YouTube", placeholder: "https://youtube.com/@channel" },
                    { field: "snapchat", label: "Snapchat", placeholder: "https://snapchat.com/add/handle" },
                  ] as { field: keyof TenantConfig; label: string; placeholder: string }[]
                ).map(({ field, label, placeholder }) => (
                  <Field key={field} label={label}>
                    <input
                      type="url"
                      value={(config[field] as string) ?? ""}
                      onChange={(e) => set(field, e.target.value)}
                      placeholder={placeholder}
                      className={inputClass}
                    />
                  </Field>
                ))}
              </FieldGroup>
            </SectionCard>

            {/* ── Target Audience ───────────────────────────────────────────── */}
            <SectionCard icon={Users} title={t("targetAudience")}>
              <div className="space-y-4">
                <Field label={t("targetDemographics")}>
                  <textarea
                    value={config.target_demographics ?? ""}
                    onChange={(e) => set("target_demographics", e.target.value)}
                    placeholder={t("targetDemographicsPlaceholder")}
                    rows={2}
                    className={inputClass}
                  />
                </Field>
                <Field label={t("targetLocations")}>
                  <input
                    type="text"
                    value={config.target_locations ?? ""}
                    onChange={(e) => set("target_locations", e.target.value)}
                    placeholder={t("targetLocationsPlaceholder")}
                    className={inputClass}
                  />
                </Field>
                <Field label={t("targetInterests")}>
                  <textarea
                    value={config.target_interests ?? ""}
                    onChange={(e) => set("target_interests", e.target.value)}
                    placeholder={t("targetInterestsPlaceholder")}
                    rows={2}
                    className={inputClass}
                  />
                </Field>
              </div>
            </SectionCard>
          </div>

          {/* Right column (1/3 width) */}
          <div className="space-y-6">

            {/* ── Brand Identity ────────────────────────────────────────────── */}
            <SectionCard icon={Palette} title={t("brandIdentity")}>
              <div className="space-y-3">
                {config.brand_voice && (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-muted">
                      {t("brandVoice")}
                    </p>
                    <p className="text-sm text-text-primary">{config.brand_voice}</p>
                  </div>
                )}
                {config.brand_tone && (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-muted">
                      {t("brandTone")}
                    </p>
                    <p className="text-sm text-text-primary">{config.brand_tone}</p>
                  </div>
                )}
                {config.brand_colors && (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-muted">
                      {t("brandColors")}
                    </p>
                    <p className="text-sm text-text-primary">{config.brand_colors}</p>
                  </div>
                )}
                {!config.brand_voice && !config.brand_tone && !config.brand_colors && (
                  <p className="text-sm text-text-muted">{t("noBrandData")}</p>
                )}
                <Link
                  href="/settings?tab=brand"
                  className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {t("goToBrandSettings")}
                  <ChevronRight className="h-3 w-3" />
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </SectionCard>

            {/* ── AI Profile Generator ──────────────────────────────────────── */}
            <SectionCard icon={Sparkles} title={t("aiGenerator")}>
              <p className="mb-4 text-sm text-text-secondary">
                {t("aiGeneratorDescription")}
              </p>
              <button
                onClick={handleGenerate}
                disabled={aiGenerating}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {aiGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {aiGenerating ? t("generating") : t("generateWithAI")}
              </button>

              {aiError && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {aiError}
                </div>
              )}

              {aiResponse && (
                <div className="mt-4">
                  <div className="max-h-80 overflow-y-auto rounded-lg border border-border bg-background px-4 py-3 text-sm text-text-secondary">
                    <pre className="whitespace-pre-wrap font-sans leading-relaxed">
                      {aiResponse}
                    </pre>
                  </div>
                  <button
                    onClick={autoFillFromAI}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {t("autoFill")}
                  </button>
                </div>
              )}
            </SectionCard>
          </div>
        </div>

        {/* Bottom save button */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? t("saving") : saveSuccess ? t("saved") : t("saveProfile")}
          </button>
        </div>
      </div>
    </div>
  );
}
