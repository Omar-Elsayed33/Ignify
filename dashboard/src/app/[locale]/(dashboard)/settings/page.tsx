"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import * as Tabs from "@radix-ui/react-tabs";
import { clsx } from "clsx";
import { Loader2, Save } from "lucide-react";
import { api } from "@/lib/api";

// ── Provider → Model mapping ────────────────────────────────────────────────

const PROVIDER_MODELS: Record<string, { label: string; models: { value: string; label: string }[] }> = {
  openai: {
    label: "OpenAI",
    models: [
      { value: "gpt-4o", label: "GPT-4o" },
      { value: "gpt-4o-mini", label: "GPT-4o Mini" },
      { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
      { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
      { value: "o1", label: "o1" },
      { value: "o1-mini", label: "o1 Mini" },
      { value: "o3-mini", label: "o3 Mini" },
    ],
  },
  anthropic: {
    label: "Anthropic",
    models: [
      { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
      { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
      { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
    ],
  },
  google: {
    label: "Google AI",
    models: [
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
      { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    ],
  },
  openrouter: {
    label: "OpenRouter",
    models: [
      { value: "openai/gpt-4o", label: "OpenAI GPT-4o" },
      { value: "openai/gpt-4o-mini", label: "OpenAI GPT-4o Mini" },
      { value: "anthropic/claude-sonnet-4", label: "Anthropic Claude Sonnet 4" },
      { value: "anthropic/claude-opus-4", label: "Anthropic Claude Opus 4" },
      { value: "google/gemini-2.5-pro", label: "Google Gemini 2.5 Pro" },
      { value: "google/gemini-2.5-flash", label: "Google Gemini 2.5 Flash" },
      { value: "meta-llama/llama-4-maverick", label: "Meta Llama 4 Maverick" },
      { value: "meta-llama/llama-4-scout", label: "Meta Llama 4 Scout" },
      { value: "deepseek/deepseek-r1", label: "DeepSeek R1" },
      { value: "deepseek/deepseek-chat-v3", label: "DeepSeek V3" },
      { value: "mistralai/mistral-large", label: "Mistral Large" },
      { value: "qwen/qwen-2.5-72b-instruct", label: "Qwen 2.5 72B" },
      { value: "cohere/command-a", label: "Cohere Command A" },
      { value: "custom", label: "Custom Model (type below)" },
    ],
  },
};

// ── Types matching backend ──────────────────────────────────────────────────

interface TenantConfig {
  ai_provider?: string;
  ai_model?: string;
  ai_api_key?: string;
  ai_base_url?: string;
  brand_name?: string;
  brand_voice?: string;
  brand_tone?: string;
  brand_color_primary?: string;
  brand_color_secondary?: string;
  brand_color_accent?: string;
  [key: string]: unknown;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  config: TenantConfig | null;
  created_at: string;
  updated_at: string;
}

// ── Shared components ───────────────────────────────────────────────────────

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-text-primary">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50";

function SaveButton({ saving, label }: { saving: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={saving}
      className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
    >
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      {label}
    </button>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const t = useTranslations("settingsPage");
  const [activeTab, setActiveTab] = useState("general");

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // General
  const [tenantName, setTenantName] = useState("");

  // AI Config
  const [aiProvider, setAiProvider] = useState("openai");
  const [aiModel, setAiModel] = useState("gpt-4o");
  const [aiCustomModel, setAiCustomModel] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiBaseUrl, setAiBaseUrl] = useState("");

  // Brand
  const [brandName, setBrandName] = useState("");
  const [brandVoice, setBrandVoice] = useState("professional");
  const [brandTone, setBrandTone] = useState("confident");
  const [colorPrimary, setColorPrimary] = useState("#FF6B00");
  const [colorSecondary, setColorSecondary] = useState("#1A1A2E");
  const [colorAccent, setColorAccent] = useState("#FFB800");

  // Saving state
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // ── Fetch tenant ────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await api.get<Tenant>("/api/v1/tenants/me");
        setTenant(data);
        hydrateFrom(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function hydrateFrom(data: Tenant) {
    setTenantName(data.name ?? "");
    const cfg: TenantConfig = data.config ?? {};
    setAiProvider(cfg.ai_provider ?? "openai");
    setAiApiKey(cfg.ai_api_key ?? "");
    setAiBaseUrl(cfg.ai_base_url ?? "");
    setBrandName(cfg.brand_name ?? "");
    setBrandVoice(cfg.brand_voice ?? "professional");
    setBrandTone(cfg.brand_tone ?? "confident");
    setColorPrimary(cfg.brand_color_primary ?? "#FF6B00");
    setColorSecondary(cfg.brand_color_secondary ?? "#1A1A2E");
    setColorAccent(cfg.brand_color_accent ?? "#FFB800");

    // Hydrate model - check if it's in the provider's list or is custom
    const provider = cfg.ai_provider ?? "openai";
    const model = cfg.ai_model ?? "";
    const providerModels = PROVIDER_MODELS[provider]?.models ?? [];
    const isKnownModel = providerModels.some((m) => m.value === model);
    if (isKnownModel) {
      setAiModel(model);
      setAiCustomModel("");
    } else if (model) {
      setAiModel("custom");
      setAiCustomModel(model);
    } else {
      setAiModel(providerModels[0]?.value ?? "");
      setAiCustomModel("");
    }
  }

  // When provider changes, reset model to first in list
  function handleProviderChange(newProvider: string) {
    setAiProvider(newProvider);
    const models = PROVIDER_MODELS[newProvider]?.models ?? [];
    setAiModel(models[0]?.value ?? "");
    setAiCustomModel("");

    // Set default base URL for OpenRouter
    if (newProvider === "openrouter") {
      setAiBaseUrl("https://openrouter.ai/api/v1");
    } else if (newProvider === "openai") {
      setAiBaseUrl("https://api.openai.com/v1");
    } else if (newProvider === "anthropic") {
      setAiBaseUrl("https://api.anthropic.com/v1");
    } else if (newProvider === "google") {
      setAiBaseUrl("https://generativelanguage.googleapis.com/v1");
    }
  }

  function getEffectiveModel(): string {
    if (aiModel === "custom") return aiCustomModel;
    return aiModel;
  }

  function mergedConfig(patch: Partial<TenantConfig>): TenantConfig {
    return { ...(tenant?.config ?? {}), ...patch };
  }

  function showSuccess(msg: string) {
    setSaveSuccess(msg);
    setTimeout(() => setSaveSuccess(null), 3000);
  }

  // ── Save handlers ─────────────────────────────────────────────────────

  async function handleSaveGeneral(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSavingGeneral(true);
      const updated = await api.put<Tenant>("/api/v1/tenants/me", { name: tenantName });
      setTenant(updated);
      showSuccess(t("saved"));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingGeneral(false);
    }
  }

  async function handleSaveAi(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSavingAi(true);
      const updated = await api.put<Tenant>("/api/v1/tenants/me", {
        config: mergedConfig({
          ai_provider: aiProvider,
          ai_model: getEffectiveModel(),
          ai_api_key: aiApiKey,
          ai_base_url: aiBaseUrl,
        }),
      });
      setTenant(updated);
      showSuccess(t("saved"));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingAi(false);
    }
  }

  async function handleSaveBrand(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSavingBrand(true);
      const updated = await api.put<Tenant>("/api/v1/tenants/me", {
        config: mergedConfig({
          brand_name: brandName,
          brand_voice: brandVoice,
          brand_tone: brandTone,
          brand_color_primary: colorPrimary,
          brand_color_secondary: colorSecondary,
          brand_color_accent: colorAccent,
        }),
      });
      setTenant(updated);
      showSuccess(t("saved"));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingBrand(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

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

  if (error) {
    return (
      <div>
        <DashboardHeader title={t("title")} />
        <div className="p-6"><p className="text-sm text-error">{error}</p></div>
      </div>
    );
  }

  const currentProviderModels = PROVIDER_MODELS[aiProvider]?.models ?? [];

  return (
    <div>
      <DashboardHeader title={t("title")} />

      {/* Save success toast */}
      {saveSuccess && (
        <div className="fixed end-6 top-20 z-50 rounded-lg bg-success/90 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {saveSuccess}
        </div>
      )}

      <div className="p-6">
        <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
          <Tabs.List className="mb-6 flex gap-1 rounded-lg bg-background p-1">
            {[
              { value: "general", label: t("general") },
              { value: "ai", label: t("aiConfig") },
              { value: "brand", label: t("brandSettings") },
            ].map((tab) => (
              <Tabs.Trigger
                key={tab.value}
                value={tab.value}
                className={clsx(
                  "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                  activeTab === tab.value
                    ? "bg-surface text-primary shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                )}
              >
                {tab.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          {/* ── General Settings ── */}
          <Tabs.Content value="general">
            <div className="max-w-2xl rounded-xl border border-border bg-surface p-6 shadow-sm">
              <h3 className="mb-6 text-lg font-semibold text-text-primary">{t("general")}</h3>
              <form onSubmit={handleSaveGeneral} className="space-y-5">
                <Field label={t("tenantName")}>
                  <input type="text" value={tenantName} onChange={(e) => setTenantName(e.target.value)} className={inputCls} required />
                </Field>
                <Field label={t("slug")} hint={`app.ignify.ai/${tenant?.slug}`}>
                  <input type="text" value={tenant?.slug ?? ""} readOnly className={clsx(inputCls, "cursor-not-allowed opacity-60")} />
                </Field>
                <SaveButton saving={savingGeneral} label={t("saveSettings")} />
              </form>
            </div>
          </Tabs.Content>

          {/* ── AI Configuration ── */}
          <Tabs.Content value="ai">
            <div className="max-w-2xl rounded-xl border border-border bg-surface p-6 shadow-sm">
              <h3 className="mb-6 text-lg font-semibold text-text-primary">{t("aiConfig")}</h3>
              <form onSubmit={handleSaveAi} className="space-y-5">

                {/* Provider */}
                <Field label={t("aiProvider")} hint={aiProvider === "openrouter" ? "Access 200+ models via OpenRouter" : undefined}>
                  <select value={aiProvider} onChange={(e) => handleProviderChange(e.target.value)} className={inputCls}>
                    {Object.entries(PROVIDER_MODELS).map(([key, p]) => (
                      <option key={key} value={key}>{p.label}</option>
                    ))}
                  </select>
                </Field>

                {/* Model (filtered by provider) */}
                <Field label={t("model")}>
                  <select
                    value={aiModel}
                    onChange={(e) => {
                      setAiModel(e.target.value);
                      if (e.target.value !== "custom") setAiCustomModel("");
                    }}
                    className={inputCls}
                  >
                    {currentProviderModels.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </Field>

                {/* Custom model input (for OpenRouter "custom" or any provider) */}
                {aiModel === "custom" && (
                  <Field label="Custom Model ID" hint="e.g. meta-llama/llama-4-maverick-17b-128e-instruct">
                    <input
                      type="text"
                      value={aiCustomModel}
                      onChange={(e) => setAiCustomModel(e.target.value)}
                      placeholder="provider/model-name"
                      className={inputCls}
                      required
                    />
                  </Field>
                )}

                {/* API Key */}
                <Field label={t("apiKey")} hint={
                  aiProvider === "openrouter" ? "Get your key at openrouter.ai/keys" :
                  aiProvider === "openai" ? "Get your key at platform.openai.com" :
                  aiProvider === "anthropic" ? "Get your key at console.anthropic.com" :
                  aiProvider === "google" ? "Get your key at aistudio.google.com" : undefined
                }>
                  <input
                    type="password"
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                    placeholder={aiProvider === "openrouter" ? "sk-or-..." : aiProvider === "anthropic" ? "sk-ant-..." : "sk-..."}
                    className={inputCls}
                    autoComplete="off"
                  />
                </Field>

                {/* Base URL (shown for OpenRouter or advanced use) */}
                <Field label="API Base URL" hint="Override only if using a custom proxy or endpoint">
                  <input
                    type="url"
                    value={aiBaseUrl}
                    onChange={(e) => setAiBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className={inputCls}
                  />
                </Field>

                {/* Current config summary */}
                <div className="rounded-lg bg-background p-4">
                  <p className="text-xs font-medium text-text-muted">Current Configuration</p>
                  <p className="mt-1 text-sm text-text-primary">
                    <span className="font-medium">{PROVIDER_MODELS[aiProvider]?.label}</span>
                    {" / "}
                    <span className="font-mono text-xs">{getEffectiveModel() || "—"}</span>
                  </p>
                  {aiApiKey && (
                    <p className="mt-0.5 text-xs text-success">API key configured</p>
                  )}
                  {!aiApiKey && (
                    <p className="mt-0.5 text-xs text-warning">No API key set — AI features won't work</p>
                  )}
                </div>

                <SaveButton saving={savingAi} label={t("saveSettings")} />
              </form>
            </div>
          </Tabs.Content>

          {/* ── Brand Settings ── */}
          <Tabs.Content value="brand">
            <div className="max-w-2xl rounded-xl border border-border bg-surface p-6 shadow-sm">
              <h3 className="mb-6 text-lg font-semibold text-text-primary">{t("brandSettings")}</h3>
              <form onSubmit={handleSaveBrand} className="space-y-5">
                <Field label={t("brandName")}>
                  <input type="text" value={brandName} onChange={(e) => setBrandName(e.target.value)} className={inputCls} />
                </Field>
                <Field label={t("brandVoice")}>
                  <select value={brandVoice} onChange={(e) => setBrandVoice(e.target.value)} className={inputCls}>
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="friendly">Friendly</option>
                    <option value="authoritative">Authoritative</option>
                    <option value="playful">Playful</option>
                  </select>
                </Field>
                <Field label={t("brandTone")}>
                  <select value={brandTone} onChange={(e) => setBrandTone(e.target.value)} className={inputCls}>
                    <option value="confident">Confident</option>
                    <option value="empathetic">Empathetic</option>
                    <option value="inspirational">Inspirational</option>
                    <option value="informative">Informative</option>
                    <option value="conversational">Conversational</option>
                  </select>
                </Field>
                <Field label={t("brandColors")}>
                  <div className="flex gap-3">
                    <div>
                      <p className="mb-1 text-xs text-text-muted">Primary</p>
                      <input type="color" value={colorPrimary} onChange={(e) => setColorPrimary(e.target.value)} className="h-10 w-16 cursor-pointer rounded border border-border" />
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-text-muted">Secondary</p>
                      <input type="color" value={colorSecondary} onChange={(e) => setColorSecondary(e.target.value)} className="h-10 w-16 cursor-pointer rounded border border-border" />
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-text-muted">Accent</p>
                      <input type="color" value={colorAccent} onChange={(e) => setColorAccent(e.target.value)} className="h-10 w-16 cursor-pointer rounded border border-border" />
                    </div>
                  </div>
                </Field>
                <SaveButton saving={savingBrand} label={t("saveSettings")} />
              </form>
            </div>
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
}
