"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Loader2, ChevronRight, ChevronLeft, Rocket, Sparkles } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";

interface AdAccount {
  id: string;
  account_id: string;
  name: string;
  platform: string;
}

interface ProposedCampaign {
  name: string;
  objective: string;
  daily_budget_usd: number;
  daily_budget_cents: number;
  share: number;
  rationale: string;
  duration_days: number;
}

interface ProposedAdset {
  campaign_name: string;
  name: string;
  daily_budget_cents: number;
  billing_event: string;
  optimization_goal: string;
}

interface ProposedCreative {
  campaign_name: string;
  image_url: string | null;
  headline: string;
  message: string;
  link: string;
}

interface GenerateResp {
  targeting_spec: Record<string, unknown>;
  proposed_campaigns: ProposedCampaign[];
  proposed_adsets: ProposedAdset[];
  proposed_creatives: ProposedCreative[];
  optimization_notes: string[];
  reasoning: string;
}

const OBJECTIVES = ["awareness", "traffic", "engagement", "leads", "conversions", "sales"];

export default function NewCampaignPage() {
  const t = useTranslations("ads");
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const [pageId, setPageId] = useState<string>("");
  const [objective, setObjective] = useState("traffic");
  const [budget, setBudget] = useState<string>("200");
  const [duration, setDuration] = useState<string>("7");
  const [audience, setAudience] = useState<string>("");
  const [products, setProducts] = useState<string>("");
  const [creatives, setCreatives] = useState<string>("");
  const [language, setLanguage] = useState<"en" | "ar">("en");

  const [generating, setGenerating] = useState(false);
  const [launching, setLaunching] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<GenerateResp | null>(null);

  useEffect(() => {
    api
      .get<AdAccount[]>("/api/v1/ads/accounts")
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, []);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const body = {
        ad_account_id: accountId,
        objective,
        budget_usd: parseFloat(budget || "0"),
        duration_days: parseInt(duration || "7", 10),
        target_audience: audience ? { description: audience } : {},
        products: products
          ? products.split("\n").filter(Boolean).map((p) => ({ name: p }))
          : [],
        creative_urls: creatives ? creatives.split("\n").filter(Boolean) : [],
        page_id: pageId,
        language,
      };
      const resp = await api.post<GenerateResp>("/api/v1/ads/campaigns/generate", body);
      setProposal(resp);
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function launchOne(idx: number) {
    if (!proposal) return;
    setLaunching(idx);
    setError(null);
    try {
      await api.post("/api/v1/ads/campaigns/launch", {
        ad_account_id: accountId,
        page_id: pageId,
        campaign: proposal.proposed_campaigns[idx],
        adset: proposal.proposed_adsets[idx] || proposal.proposed_adsets[0],
        creative: proposal.proposed_creatives[idx] || proposal.proposed_creatives[0],
        targeting_spec: proposal.targeting_spec,
        duration_days: parseInt(duration || "7", 10),
      });
      router.push("/ads");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Launch failed");
    } finally {
      setLaunching(null);
    }
  }

  const canNext =
    step === 1 ? accountId && budget && duration && objective
      : step === 2 ? true
      : step === 3 ? true
      : false;

  return (
    <div>
      <DashboardHeader title={t("newTitle")} />
      <div className="mx-auto max-w-3xl p-6">
        {/* Stepper */}
        <div className="mb-6 flex items-center gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className={`flex-1 rounded-full py-1.5 text-center text-xs font-medium ${step === n ? "bg-primary text-white" : step > n ? "bg-success/20 text-success" : "bg-surface text-text-muted"}`}>
              {t(`step${n}`)}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-error/10 px-4 py-2 text-sm text-error">{error}</div>
        )}

        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">{t("step1")}</h2>
              <div>
                <label className="mb-1 block text-sm font-medium">{t("adAccount")}</label>
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="">{t("selectAccount")}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.account_id})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t("pageId")}</label>
                <input value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder="FB Page ID" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t("objective")}</label>
                <select value={objective} onChange={(e) => setObjective(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm capitalize">
                  {OBJECTIVES.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">{t("budgetUsd")}</label>
                  <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">{t("durationDays")}</label>
                  <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t("language")}</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value as "en" | "ar")} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">{t("step2")}</h2>
              <div>
                <label className="mb-1 block text-sm font-medium">{t("audienceDescription")}</label>
                <textarea rows={6} value={audience} onChange={(e) => setAudience(e.target.value)} placeholder={t("audiencePlaceholder")} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">{t("step3")}</h2>
              <div>
                <label className="mb-1 block text-sm font-medium">{t("productsLabel")}</label>
                <textarea rows={4} value={products} onChange={(e) => setProducts(e.target.value)} placeholder={t("productsPlaceholder")} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t("creativesLabel")}</label>
                <textarea rows={4} value={creatives} onChange={(e) => setCreatives(e.target.value)} placeholder="https://.../image1.jpg" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
            </div>
          )}

          {step === 4 && proposal && (
            <div className="space-y-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Sparkles className="h-5 w-5 text-primary" />
                {t("step4")}
              </h2>
              <p className="text-sm text-text-muted">{proposal.reasoning}</p>

              {proposal.optimization_notes.length > 0 && (
                <ul className="space-y-1 rounded-lg bg-info/5 p-3 text-xs text-info">
                  {proposal.optimization_notes.map((n, i) => <li key={i}>• {n}</li>)}
                </ul>
              )}

              <div className="space-y-3">
                {proposal.proposed_campaigns.map((c, i) => {
                  const creative = proposal.proposed_creatives[i];
                  return (
                    <div key={i} className="rounded-lg border border-border p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold">{c.name}</p>
                          <p className="mt-0.5 text-xs text-text-muted">{c.objective} • ${c.daily_budget_usd}/day • {c.duration_days}d</p>
                          <p className="mt-2 text-xs">{c.rationale}</p>
                          {creative && (
                            <div className="mt-2 rounded bg-background p-2 text-xs">
                              <strong>{creative.headline}</strong>
                              <p className="text-text-muted">{creative.message}</p>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => launchOne(i)}
                          disabled={launching !== null}
                          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-60"
                        >
                          {launching === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                          {t("launch")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            <button
              disabled={step === 1}
              onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s))}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> {t("back")}
            </button>
            {step < 3 && (
              <button
                disabled={!canNext}
                onClick={() => setStep((s) => ((s + 1) as 1 | 2 | 3 | 4))}
                className="flex items-center gap-1 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {t("next")} <ChevronRight className="h-4 w-4" />
              </button>
            )}
            {step === 3 && (
              <button
                onClick={generate}
                disabled={generating}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {t("generate")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
