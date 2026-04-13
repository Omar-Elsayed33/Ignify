"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import {
  Loader2,
  Plus,
  X,
  Globe,
  Save,
  Sparkles,
  Upload,
  Building2,
  Palette,
  Users,
  Check,
} from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import AIAssistButton from "@/components/AIAssistButton";

const INDUSTRIES = ["ecommerce", "restaurant", "clinic", "real_estate", "services", "saas", "other"] as const;
const COUNTRIES = ["EG", "SA", "AE", "KW", "QA", "BH", "OM", "other"] as const;
const LANGS = ["ar", "en", "both"] as const;
const TONES = ["professional", "friendly", "playful", "luxury", "bold", "educational"] as const;

interface BusinessProfile {
  industry: string | null;
  country: string | null;
  primary_language: string | null;
  description: string | null;
  target_audience: string | null;
  products: string[];
  competitors: string[];
  website: string | null;
  business_name: string | null;
  phone?: string | null;
  business_email?: string | null;
}

interface BrandResponse {
  brand_name: string | null;
  tone: string | null;
  colors: Record<string, string>;
  fonts: Record<string, string>;
  logo_url: string | null;
  forbidden_words: string[];
}

type TabId = "business" | "brand" | "competitors";

interface DiscoveredCompetitor {
  name: string;
  status: "pending" | "accepted" | "rejected";
}

export default function SettingsBusinessProfilePage() {
  const t = useTranslations("settingsBusiness");
  const tBrand = useTranslations("settingsBrand");
  const tOb = useTranslations("onboarding");
  const tAI = useTranslations("aiAssist");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("business");

  // Business fields
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("ecommerce");
  const [country, setCountry] = useState("EG");
  const [primaryLanguage, setPrimaryLanguage] = useState("ar");
  const [description, setDescription] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [products, setProducts] = useState<string[]>([""]);
  const [competitors, setCompetitors] = useState<string[]>([""]);
  const [website, setWebsite] = useState("");
  const [phone, setPhone] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");

  // Brand fields
  const [brandName, setBrandName] = useState("");
  const [tone, setTone] = useState("friendly");
  const [forbiddenWords, setForbiddenWords] = useState<string[]>([]);
  const [wordInput, setWordInput] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [secondaryColor, setSecondaryColor] = useState("#f59e0b");
  const [accentColor, setAccentColor] = useState("#10b981");
  const [bodyFont, setBodyFont] = useState("");
  const [headingFont, setHeadingFont] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // AI state
  const [analyzing, setAnalyzing] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredCompetitor[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [bp, br] = await Promise.all([
          api.get<BusinessProfile>("/api/v1/tenant-settings/business-profile"),
          api.get<BrandResponse>("/api/v1/tenant-settings/brand"),
        ]);
        // Business
        if (bp.business_name) setBusinessName(bp.business_name);
        if (bp.industry) setIndustry(bp.industry);
        if (bp.country) setCountry(bp.country);
        if (bp.primary_language) setPrimaryLanguage(bp.primary_language);
        setDescription(bp.description ?? "");
        setTargetAudience(bp.target_audience ?? "");
        setProducts(bp.products?.length ? bp.products : [""]);
        setCompetitors(bp.competitors?.length ? bp.competitors : [""]);
        setWebsite(bp.website ?? "");
        setPhone(bp.phone ?? "");
        setBusinessEmail(bp.business_email ?? "");
        // Brand
        setBrandName(br.brand_name ?? "");
        if (br.tone) setTone(br.tone);
        setForbiddenWords(br.forbidden_words || []);
        setLogoUrl(br.logo_url ?? "");
        if (br.colors?.primary) setPrimaryColor(br.colors.primary);
        if (br.colors?.secondary) setSecondaryColor(br.colors.secondary);
        if (br.colors?.accent) setAccentColor(br.colors.accent);
        if (br.fonts?.body) setBodyFont(br.fonts.body);
        if (br.fonts?.heading) setHeadingFont(br.fonts.heading);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("errors.failed"));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const saveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // Sequential saves to avoid race condition on tenant.config JSON column
      await api.put("/api/v1/tenant-settings/business-profile", {
        business_name: businessName || null,
        industry,
        country,
        primary_language: primaryLanguage,
        description,
        target_audience: targetAudience,
        products: products.map((p) => p.trim()).filter(Boolean),
        competitors: competitors.map((c) => c.trim()).filter(Boolean),
        website: website || null,
        phone: phone || null,
        business_email: businessEmail || null,
      });
      await api.put("/api/v1/tenant-settings/brand", {
        brand_name: brandName || null,
        tone,
        forbidden_words: forbiddenWords,
        colors: { primary: primaryColor, secondary: secondaryColor, accent: accentColor },
        fonts: { body: bodyFont, heading: headingFont },
        logo_url: logoUrl || null,
      });
      showToast(t("saveAllSuccess"));
    } catch {
      setError(t("errors.failed"));
    } finally {
      setSaving(false);
    }
  };

  const analyzeWebsite = async () => {
    if (!website.trim()) return;
    setAnalyzing(true);
    try {
      const data = await api.post<{
        description?: string;
        target_audience?: string;
        main_products?: string[];
        main_services?: string[];
        probable_competitors?: Array<{ name?: string; url?: string } | string>;
      }>("/api/v1/ai-assistant/draft-business-profile", {
        website_url: website,
        lang: primaryLanguage === "ar" ? "ar" : "en",
        country,
      });
      if (data.description) setDescription(data.description);
      if (data.target_audience) setTargetAudience(data.target_audience);
      const prods = [...(data.main_products || []), ...(data.main_services || [])].filter(Boolean);
      if (prods.length) setProducts(prods);
      const comps = (data.probable_competitors || [])
        .map((c) => (typeof c === "string" ? c : c.name || c.url || ""))
        .filter(Boolean);
      if (comps.length) setCompetitors(comps);
    } catch {
      /* non-fatal */
    } finally {
      setAnalyzing(false);
    }
  };

  const discoverCompetitors = async () => {
    setDiscovering(true);
    try {
      const data = await api.post<{ competitors?: Array<{ name?: string } | string> }>(
        "/api/v1/ai-assistant/discover-competitors",
        {
          business_name: businessName || description.split(".")[0] || "business",
          industry,
          country,
          lang: primaryLanguage === "ar" ? "ar" : "en",
          description,
          products: products.map((p) => p.trim()).filter(Boolean),
          website,
        }
      );
      const names = (data.competitors || [])
        .map((c) => (typeof c === "string" ? c : c.name || ""))
        .filter(Boolean);
      const existing = new Set(competitors.map((c) => c.trim()).filter(Boolean));
      setDiscovered(
        names
          .filter((n) => !existing.has(n))
          .map((n) => ({ name: n, status: "pending" as const }))
      );
    } catch {
      /* non-fatal */
    } finally {
      setDiscovering(false);
    }
  };

  const acceptDiscovered = (name: string) => {
    setCompetitors((arr) => {
      const cleaned = arr.map((c) => c.trim()).filter(Boolean);
      if (cleaned.includes(name)) return arr;
      return [...cleaned, name];
    });
    setDiscovered((arr) => arr.map((d) => (d.name === name ? { ...d, status: "accepted" } : d)));
  };

  const rejectDiscovered = (name: string) => {
    setDiscovered((arr) => arr.map((d) => (d.name === name ? { ...d, status: "rejected" } : d)));
  };

  const onFilePick = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post<{ url: string }>("/api/v1/media/upload", fd);
      if (res?.url) {
        setLogoUrl(res.url);
        await extractColors(res.url);
      }
    } catch {
      setError(t("errors.failed"));
    } finally {
      setUploading(false);
    }
  };

  const extractColors = async (url?: string) => {
    const u = url || logoUrl;
    if (!u) return;
    setExtracting(true);
    try {
      const colors = await api.post<{
        primary_color?: string;
        secondary_color?: string;
        accent_color?: string;
      }>("/api/v1/ai-assistant/analyze-logo", { logo_url: u });
      if (colors?.primary_color) setPrimaryColor(colors.primary_color);
      if (colors?.secondary_color) setSecondaryColor(colors.secondary_color);
      if (colors?.accent_color) setAccentColor(colors.accent_color);
    } catch {
      /* non-fatal */
    } finally {
      setExtracting(false);
    }
  };

  const addWord = () => {
    const v = wordInput.trim();
    if (v && !forbiddenWords.includes(v)) setForbiddenWords((arr) => [...arr, v]);
    setWordInput("");
  };

  const onWordKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addWord();
    }
  };

  const updateList = (setter: React.Dispatch<React.SetStateAction<string[]>>, i: number, v: string) =>
    setter((arr) => arr.map((x, idx) => (idx === i ? v : x)));
  const addItem = (setter: React.Dispatch<React.SetStateAction<string[]>>) =>
    setter((arr) => [...arr, ""]);
  const removeItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, i: number) =>
    setter((arr) => arr.filter((_, idx) => idx !== i));

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

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: "business", label: t("tabs.business"), icon: Building2 },
    { id: "brand", label: t("tabs.brand"), icon: Palette },
    { id: "competitors", label: t("tabs.competitors"), icon: Users },
  ];

  return (
    <div>
      <DashboardHeader title={t("title")} />
      {toast && (
        <div className="fixed end-6 top-20 z-50 rounded-lg bg-success/90 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
      <div className="p-6">
        <form onSubmit={saveAll} className="max-w-4xl space-y-5 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <p className="text-sm text-text-secondary">{t("subtitle")}</p>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-border">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Section A — Business Info */}
          {activeTab === "business" && (
            <div className="space-y-5">
              {/* Website + AI */}
              <div className="rounded-lg border border-border bg-surface-container-lowest p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Globe className="h-4 w-4" />
                  {t("form.website")}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://example.com"
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                  <AIAssistButton
                    onClick={analyzeWebsite}
                    loading={analyzing}
                    disabled={!website.trim()}
                    label={t("aiAnalyze")}
                    loadingLabel={tAI("analyzeWebsite.analyzing")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">{t("form.businessName")}</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">{t("form.industry")}</label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    {INDUSTRIES.map((i) => (
                      <option key={i} value={i}>{tOb(`business.industryOptions.${i}`)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">{t("form.country")}</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>{tOb(`business.countryOptions.${c}`)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">{t("form.language")}</label>
                  <div className="flex gap-2">
                    {LANGS.map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setPrimaryLanguage(l)}
                        className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                          primaryLanguage === l
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background"
                        }`}
                      >
                        {l.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">{t("form.description")}</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">{t("form.audience")}</label>
                <textarea
                  rows={2}
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">{t("form.products")}</label>
                <div className="space-y-2">
                  {products.map((p, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        value={p}
                        onChange={(e) => updateList(setProducts, i, e.target.value)}
                        className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                      />
                      {products.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(setProducts, i)}
                          className="rounded-md border border-border p-2 hover:bg-surface-hover"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addItem(setProducts)}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <Plus className="h-4 w-4" /> {tOb("business.addProduct")}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">{t("form.phone")}</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+20 000 000 0000"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">{t("form.businessEmail")}</label>
                  <input
                    type="email"
                    value={businessEmail}
                    onChange={(e) => setBusinessEmail(e.target.value)}
                    placeholder="hello@yourbusiness.com"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section B — Brand & Identity */}
          {activeTab === "brand" && (
            <div className="space-y-5">
              <div>
                <label className="mb-1 block text-sm font-medium">{tBrand("form.name")}</label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">{tBrand("form.tone")}</label>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {TONES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setTone(v)}
                      className={`rounded-md border px-3 py-2 text-sm ${
                        tone === v ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"
                      }`}
                    >
                      {tOb(`brand.toneOptions.${v}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">{tBrand("form.forbiddenWords")}</label>
                <div className="rounded-md border border-border bg-background p-2">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {forbiddenWords.map((w) => (
                      <span
                        key={w}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                      >
                        {w}
                        <button
                          type="button"
                          onClick={() => setForbiddenWords((arr) => arr.filter((x) => x !== w))}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    value={wordInput}
                    onChange={(e) => setWordInput(e.target.value)}
                    onKeyDown={onWordKey}
                    onBlur={addWord}
                    className="w-full bg-transparent px-1 py-1 text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">{tBrand("form.logo")}</label>
                <div className="space-y-2">
                  <div
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const f = e.dataTransfer.files?.[0];
                      if (f) void onFilePick(f);
                    }}
                    className="flex cursor-pointer items-center justify-center gap-3 rounded-md border-2 border-dashed border-border bg-background px-4 py-6 text-sm text-text-secondary hover:bg-surface-hover"
                  >
                    {uploading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="logo" className="h-12 w-12 rounded-md object-contain" />
                    ) : (
                      <Upload className="h-5 w-5" />
                    )}
                    <span>
                      {uploading
                        ? tAI("uploadLogo.processing")
                        : logoUrl
                        ? tAI("uploadLogo.replace")
                        : tBrand("form.dragDrop")}
                    </span>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onFilePick(f);
                    }}
                  />
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder={tBrand("form.uploadLogo")}
                      className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                    {logoUrl && (
                      <AIAssistButton
                        onClick={() => extractColors()}
                        loading={extracting}
                        label={tBrand("extractColors")}
                        loadingLabel={tAI("extractLogo.analyzing")}
                        size="sm"
                        variant="ghost"
                      />
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">{tBrand("form.colors")}</label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {[
                    { label: tBrand("form.primaryColor"), value: primaryColor, set: setPrimaryColor },
                    { label: tBrand("form.secondaryColor"), value: secondaryColor, set: setSecondaryColor },
                    { label: tBrand("form.accentColor"), value: accentColor, set: setAccentColor },
                  ].map((c) => (
                    <div
                      key={c.label}
                      className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
                    >
                      <input
                        type="color"
                        value={c.value}
                        onChange={(e) => c.set(e.target.value)}
                        className="h-8 w-10 cursor-pointer rounded"
                      />
                      <div className="flex-1">
                        <div className="text-xs text-text-secondary">{c.label}</div>
                        <input
                          value={c.value}
                          onChange={(e) => c.set(e.target.value)}
                          className="w-full bg-transparent text-sm outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">{tBrand("form.fonts")}</label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input
                    value={headingFont}
                    onChange={(e) => setHeadingFont(e.target.value)}
                    placeholder="Heading font"
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                  <input
                    value={bodyFont}
                    onChange={(e) => setBodyFont(e.target.value)}
                    placeholder="Body font"
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section C — Competitors */}
          {activeTab === "competitors" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{t("competitors")}</h3>
                <button
                  type="button"
                  onClick={discoverCompetitors}
                  disabled={discovering}
                  className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                >
                  {discovering ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {discovering
                    ? t("discoverCompetitors.loading")
                    : t("discoverCompetitors.button")}
                </button>
              </div>

              <div className="space-y-2">
                {competitors.map((c, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={c}
                      onChange={(e) => updateList(setCompetitors, i, e.target.value)}
                      className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                    {competitors.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(setCompetitors, i)}
                        className="rounded-md border border-border p-2 hover:bg-surface-hover"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addItem(setCompetitors)}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Plus className="h-4 w-4" /> {tOb("business.addCompetitor")}
                </button>
              </div>

              {discovered.length > 0 && (
                <div className="rounded-lg border border-border bg-surface-container-lowest p-4">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    {t("discoverCompetitors.suggestionsTitle")}
                  </h4>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {discovered.map((d) => (
                      <div
                        key={d.name}
                        className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${
                          d.status === "accepted"
                            ? "border-success/40 bg-success/5"
                            : d.status === "rejected"
                            ? "border-border bg-background opacity-60"
                            : "border-border bg-background"
                        }`}
                      >
                        <span className="truncate font-medium">{d.name}</span>
                        {d.status === "pending" ? (
                          <div className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              onClick={() => acceptDiscovered(d.name)}
                              className="rounded-md border border-success/40 bg-success/10 p-1.5 text-success hover:bg-success/20"
                              title={t("discoverCompetitors.accept")}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => rejectDiscovered(d.name)}
                              className="rounded-md border border-border p-1.5 text-text-secondary hover:bg-surface-hover"
                              title={t("discoverCompetitors.reject")}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-text-secondary">
                            {d.status === "accepted"
                              ? t("discoverCompetitors.accept")
                              : t("discoverCompetitors.reject")}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</div>}

          <div className="flex justify-end border-t border-border pt-4">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? t("saving") : t("saveAll")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
