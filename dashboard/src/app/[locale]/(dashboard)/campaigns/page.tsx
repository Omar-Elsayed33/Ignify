"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import Modal from "@/components/Modal";
import { api } from "@/lib/api";
import {
  Plus,
  Mail,
  Share2,
  Megaphone,
  FileText,
  MessageSquare,
  Layers,
  Rocket,
  Trash2,
  AlertCircle,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { clsx } from "clsx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Campaign {
  id: string;
  name: string;
  campaign_type: "email_drip" | "social" | "ads" | "multi_channel";
  status: "draft" | "active" | "paused" | "completed";
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  config?: {
    description?: string;
    goal?: string;
    target_audience?: string;
    budget?: number;
    duration_days?: number;
  };
}

interface CampaignStep {
  id: string;
  campaign_id: string;
  step_number: number;
  action_type: "social_post" | "email" | "ad" | "blog" | "sms";
  title: string;
  platform: string | null;
  content: string | null;
  status: "pending" | "scheduled" | "completed";
  delay_hours: number;
}

interface AIForm {
  goal: string;
  campaign_type: Campaign["campaign_type"];
  target_audience: string;
  budget: string;
  duration_days: string;
}

interface ManualForm {
  name: string;
  campaign_type: Campaign["campaign_type"];
  start_date: string;
  end_date: string;
}

interface AddStepForm {
  action_type: CampaignStep["action_type"];
  title: string;
  platform: string;
  content: string;
  delay_hours: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const typeIcons: Record<string, React.ElementType> = {
  email_drip: Mail,
  social: Share2,
  ads: Megaphone,
  multi_channel: Layers,
};

const stepActionIcons: Record<string, React.ElementType> = {
  social_post: Share2,
  email: Mail,
  ad: Megaphone,
  blog: FileText,
  sms: MessageSquare,
};

const statusColors: Record<string, string> = {
  active: "bg-success/10 text-success",
  draft: "bg-text-muted/10 text-text-muted",
  completed: "bg-info/10 text-info",
  paused: "bg-warning/10 text-warning",
};

const stepStatusColors: Record<string, string> = {
  pending: "bg-text-muted/10 text-text-muted",
  scheduled: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-border" />
          <div>
            <div className="h-4 w-32 rounded bg-border" />
            <div className="mt-1 h-3 w-16 rounded bg-border" />
          </div>
        </div>
        <div className="h-5 w-16 rounded-full bg-border" />
      </div>
      <div className="mt-4 h-3 w-full rounded bg-border" />
      <div className="mt-2 h-3 w-3/4 rounded bg-border" />
      <div className="mt-4 flex gap-2">
        <div className="h-7 w-20 rounded-lg bg-border" />
        <div className="h-7 w-7 rounded-lg bg-border ms-auto" />
      </div>
    </div>
  );
}

// ─── Campaign Detail (Expanded) ───────────────────────────────────────────────

interface CampaignDetailProps {
  campaign: Campaign;
  onLaunch: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onStepAdded: (campaignId: string, step: CampaignStep) => void;
}

function CampaignDetail({ campaign, onLaunch, onDelete, onStepAdded }: CampaignDetailProps) {
  const t = useTranslations("campaignsPage");

  const [steps, setSteps] = useState<CampaignStep[] | null>(null);
  const [stepsLoading, setStepsLoading] = useState(false);
  const [stepsError, setStepsError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addStepOpen, setAddStepOpen] = useState(false);
  const [addStepSubmitting, setAddStepSubmitting] = useState(false);
  const [addStepError, setAddStepError] = useState<string | null>(null);
  const [addStepForm, setAddStepForm] = useState<AddStepForm>({
    action_type: "social_post",
    title: "",
    platform: "",
    content: "",
    delay_hours: "0",
  });

  useEffect(() => {
    async function loadSteps() {
      try {
        setStepsLoading(true);
        setStepsError(null);
        const data = await api.get<CampaignStep[]>(`/api/v1/campaigns/${campaign.id}/steps`);
        setSteps(data);
      } catch (err) {
        setStepsError(err instanceof Error ? err.message : "Failed to load steps");
      } finally {
        setStepsLoading(false);
      }
    }
    loadSteps();
  }, [campaign.id]);

  async function handleLaunch() {
    setLaunching(true);
    await onLaunch(campaign.id);
    setLaunching(false);
  }

  async function handleDelete() {
    setDeleting(true);
    await onDelete(campaign.id);
    setDeleting(false);
  }

  async function handleAddStep(e: React.FormEvent) {
    e.preventDefault();
    if (!addStepForm.title.trim()) return;
    try {
      setAddStepSubmitting(true);
      setAddStepError(null);
      const newStep = await api.post<CampaignStep>(`/api/v1/campaigns/${campaign.id}/steps`, {
        action_type: addStepForm.action_type,
        title: addStepForm.title,
        platform: addStepForm.platform || null,
        content: addStepForm.content || null,
        delay_hours: parseInt(addStepForm.delay_hours, 10) || 0,
      });
      setSteps((prev) => (prev ? [...prev, newStep] : [newStep]));
      onStepAdded(campaign.id, newStep);
      setAddStepOpen(false);
      setAddStepForm({ action_type: "social_post", title: "", platform: "", content: "", delay_hours: "0" });
    } catch (err) {
      setAddStepError(err instanceof Error ? err.message : "Failed to add step");
    } finally {
      setAddStepSubmitting(false);
    }
  }

  const description = campaign.config?.description || campaign.config?.goal || null;

  return (
    <div className="border-t border-border bg-background/50 px-5 py-4">
      {/* Description */}
      {description && (
        <p className="mb-4 text-sm text-text-secondary leading-relaxed">{description}</p>
      )}

      {/* Meta row */}
      <div className="mb-4 flex flex-wrap gap-4 text-xs text-text-muted">
        {campaign.start_date && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {t("startDate")}: {campaign.start_date}
          </span>
        )}
        {campaign.end_date && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {t("endDate")}: {campaign.end_date}
          </span>
        )}
        {campaign.config?.target_audience && (
          <span>{t("targetAudience")}: {campaign.config.target_audience}</span>
        )}
        {campaign.config?.budget && (
          <span>{t("budget")}: ${campaign.config.budget}</span>
        )}
      </div>

      {/* Steps heading */}
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-text-primary">{t("steps")}</h4>
        <button
          onClick={() => setAddStepOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface-hover"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("addStep")}
        </button>
      </div>

      {/* Steps list */}
      {stepsLoading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("loading")}
        </div>
      ) : stepsError ? (
        <div className="flex items-center gap-2 rounded-lg bg-error/10 px-3 py-2 text-xs text-error">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {stepsError}
        </div>
      ) : !steps || steps.length === 0 ? (
        <p className="py-4 text-center text-sm text-text-muted">{t("noSteps")}</p>
      ) : (
        <ol className="relative border-s border-border ms-3 space-y-0">
          {steps.map((step, idx) => {
            const ActionIcon = stepActionIcons[step.action_type] ?? Layers;
            const isLast = idx === steps.length - 1;
            return (
              <li key={step.id} className={clsx("ms-5 pb-5", isLast && "pb-1")}>
                {/* Timeline dot */}
                <span className="absolute -start-3 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface">
                  <ActionIcon className="h-3 w-3 text-primary" />
                </span>

                <div className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-text-muted">#{step.step_number}</span>
                    <span className="text-sm font-semibold text-text-primary">{step.title}</span>
                    {step.platform && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary capitalize">
                        {step.platform}
                      </span>
                    )}
                    <span className={clsx("ms-auto rounded-full px-2 py-0.5 text-xs font-medium", stepStatusColors[step.status] ?? stepStatusColors.pending)}>
                      {t(step.status as "pending" | "scheduled" | "completed")}
                    </span>
                  </div>

                  {step.content && (
                    <p className="mt-2 text-xs text-text-secondary leading-relaxed line-clamp-3">
                      {step.content}
                    </p>
                  )}

                  {step.delay_hours > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-text-muted">
                      <Clock className="h-3 w-3" />
                      +{step.delay_hours}h {t("delay")}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Action buttons */}
      <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
        {campaign.status === "draft" && (
          <button
            onClick={handleLaunch}
            disabled={launching}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {launching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Rocket className="h-3.5 w-3.5" />
            )}
            {launching ? t("launching") : t("launchCampaign")}
          </button>
        )}
        {campaign.status === "active" && (
          <span className="flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t("active")}
          </span>
        )}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="ms-auto flex items-center gap-1.5 rounded-lg border border-error/30 px-3 py-1.5 text-xs font-medium text-error hover:bg-error/10 disabled:opacity-60"
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          {t("delete")}
        </button>
      </div>

      {/* Add Step Modal */}
      <Modal open={addStepOpen} onOpenChange={setAddStepOpen} title={t("addStep")}>
        <form onSubmit={handleAddStep} className="space-y-4">
          {addStepError && (
            <div className="flex items-center gap-2 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {addStepError}
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("stepActionType")}</label>
            <select
              value={addStepForm.action_type}
              onChange={(e) => setAddStepForm((f) => ({ ...f, action_type: e.target.value as CampaignStep["action_type"] }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="social_post">{t("actionSocialPost")}</option>
              <option value="email">{t("actionEmail")}</option>
              <option value="ad">{t("actionAd")}</option>
              <option value="blog">{t("actionBlog")}</option>
              <option value="sms">{t("actionSms")}</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("stepTitle")}</label>
            <input
              type="text"
              required
              value={addStepForm.title}
              onChange={(e) => setAddStepForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("platform")}</label>
              <input
                type="text"
                value={addStepForm.platform}
                onChange={(e) => setAddStepForm((f) => ({ ...f, platform: e.target.value }))}
                placeholder="e.g. Instagram"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("delayHours")}</label>
              <input
                type="number"
                min="0"
                value={addStepForm.delay_hours}
                onChange={(e) => setAddStepForm((f) => ({ ...f, delay_hours: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("stepContent")}</label>
            <textarea
              rows={4}
              value={addStepForm.content}
              onChange={(e) => setAddStepForm((f) => ({ ...f, content: e.target.value }))}
              placeholder={t("stepContentPlaceholder")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setAddStepOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={addStepSubmitting}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {addStepSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("addStep")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─── Campaign Card ─────────────────────────────────────────────────────────────

interface CampaignCardProps {
  campaign: Campaign;
  expanded: boolean;
  onToggle: () => void;
  onLaunch: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onStepAdded: (campaignId: string, step: CampaignStep) => void;
}

function CampaignCard({ campaign, expanded, onToggle, onLaunch, onDelete, onStepAdded }: CampaignCardProps) {
  const t = useTranslations("campaignsPage");
  const TypeIcon = typeIcons[campaign.campaign_type] ?? Layers;

  return (
    <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden transition-shadow hover:shadow-md">
      {/* Card header — always visible */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 rounded-lg bg-primary/10 p-2">
              <TypeIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">{campaign.name}</p>
              <p className="text-xs capitalize text-text-muted">
                {campaign.campaign_type.replace(/_/g, " ")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", statusColors[campaign.status])}>
              {t(campaign.status as "active" | "draft" | "completed" | "paused")}
            </span>
            {campaign.config?.goal && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {t("aiGenerated")}
              </span>
            )}
          </div>
        </div>

        {/* Description preview */}
        {(campaign.config?.description || campaign.config?.goal) && (
          <p className="mt-3 line-clamp-2 text-xs text-text-secondary leading-relaxed">
            {campaign.config?.description || campaign.config?.goal}
          </p>
        )}

        {/* Expand/collapse toggle */}
        <button
          onClick={onToggle}
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-border py-1.5 text-xs font-medium text-text-muted hover:bg-surface-hover transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              {t("collapse")}
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              {t("expand")}
            </>
          )}
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <CampaignDetail
          campaign={campaign}
          onLaunch={onLaunch}
          onDelete={onDelete}
          onStepAdded={onStepAdded}
        />
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const t = useTranslations("campaignsPage");

  // List state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"ai" | "manual">("ai");

  // AI form state
  const [aiForm, setAiForm] = useState<AIForm>({
    goal: "",
    campaign_type: "multi_channel",
    target_audience: "",
    budget: "",
    duration_days: "30",
  });
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Manual form state
  const [manualForm, setManualForm] = useState<ManualForm>({
    name: "",
    campaign_type: "email_drip",
    start_date: "",
    end_date: "",
  });
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<Campaign[]>("/api/v1/campaigns/");
      setCampaigns(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleGenerateAI(e: React.FormEvent) {
    e.preventDefault();
    if (!aiForm.goal.trim()) return;
    try {
      setAiGenerating(true);
      setAiError(null);
      const newCampaign = await api.post<Campaign>("/api/v1/campaigns/generate", {
        goal: aiForm.goal,
        campaign_type: aiForm.campaign_type,
        target_audience: aiForm.target_audience || undefined,
        budget: aiForm.budget ? parseFloat(aiForm.budget) : undefined,
        duration_days: aiForm.duration_days ? parseInt(aiForm.duration_days, 10) : undefined,
      });
      setCampaigns((prev) => [newCampaign, ...prev]);
      setExpandedId(newCampaign.id);
      setCreateOpen(false);
      setAiForm({ goal: "", campaign_type: "multi_channel", target_audience: "", budget: "", duration_days: "30" });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Failed to generate campaign");
    } finally {
      setAiGenerating(false);
    }
  }

  async function handleManualCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!manualForm.name.trim()) return;
    try {
      setManualSubmitting(true);
      setManualError(null);
      const newCampaign = await api.post<Campaign>("/api/v1/campaigns/", {
        name: manualForm.name,
        campaign_type: manualForm.campaign_type,
        start_date: manualForm.start_date || undefined,
        end_date: manualForm.end_date || undefined,
        status: "draft",
      });
      setCampaigns((prev) => [newCampaign, ...prev]);
      setExpandedId(newCampaign.id);
      setCreateOpen(false);
      setManualForm({ name: "", campaign_type: "email_drip", start_date: "", end_date: "" });
    } catch (err) {
      setManualError(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setManualSubmitting(false);
    }
  }

  async function handleLaunch(id: string) {
    try {
      const updated = await api.post<Campaign>(`/api/v1/campaigns/${id}/launch`);
      setCampaigns((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to launch campaign");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await api.delete(`/api/v1/campaigns/${id}`);
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete campaign");
    }
  }

  function handleStepAdded(_campaignId: string, _step: CampaignStep) {
    // Steps are managed inside CampaignDetail; nothing to do at page level
  }

  function handleToggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function handleOpenCreate() {
    setAiError(null);
    setManualError(null);
    setCreateOpen(true);
  }

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = campaigns.filter((c) => {
    if (filterType !== "all" && c.campaign_type !== filterType) return false;
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    return true;
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        {/* Global error */}
        {error && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Toolbar */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-primary focus:border-primary focus:outline-none"
            >
              <option value="all">{t("campaignType")}</option>
              <option value="email_drip">{t("email")}</option>
              <option value="social">{t("social")}</option>
              <option value="ads">{t("ads")}</option>
              <option value="multi_channel">{t("multi")}</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-primary focus:border-primary focus:outline-none"
            >
              <option value="all">{t("status")}</option>
              <option value="active">{t("active")}</option>
              <option value="draft">{t("draft")}</option>
              <option value="completed">{t("completed")}</option>
              <option value="paused">{t("paused")}</option>
            </select>
          </div>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" />
            {t("createCampaign")}
          </button>
        </div>

        {/* Campaign grid */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <p className="mt-4 text-base font-semibold text-text-primary">{t("emptyTitle")}</p>
            <p className="mt-2 max-w-xs text-sm text-text-muted">{t("emptyDescription")}</p>
            <button
              onClick={handleOpenCreate}
              className="mt-6 flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
            >
              <Sparkles className="h-4 w-4" />
              {t("generateWithAI")}
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                expanded={expandedId === campaign.id}
                onToggle={() => handleToggleExpand(campaign.id)}
                onLaunch={handleLaunch}
                onDelete={handleDelete}
                onStepAdded={handleStepAdded}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Campaign Modal */}
      <Modal open={createOpen} onOpenChange={setCreateOpen} title={t("createCampaign")}>
        {/* Mode tabs */}
        <div className="mb-5 flex rounded-lg border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setCreateMode("ai")}
            className={clsx(
              "flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors",
              createMode === "ai"
                ? "bg-primary text-white"
                : "bg-surface text-text-secondary hover:bg-surface-hover"
            )}
          >
            <Sparkles className="h-4 w-4" />
            {t("aiGenerated")}
          </button>
          <button
            type="button"
            onClick={() => setCreateMode("manual")}
            className={clsx(
              "flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors",
              createMode === "manual"
                ? "bg-primary text-white"
                : "bg-surface text-text-secondary hover:bg-surface-hover"
            )}
          >
            <Layers className="h-4 w-4" />
            {t("manual")}
          </button>
        </div>

        {/* AI Generation Form */}
        {createMode === "ai" && (
          <form onSubmit={handleGenerateAI} className="space-y-4">
            {aiError && (
              <div className="flex items-center gap-2 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {aiError}
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("goal")}</label>
              <textarea
                required
                rows={3}
                value={aiForm.goal}
                onChange={(e) => setAiForm((f) => ({ ...f, goal: e.target.value }))}
                placeholder={t("goalPlaceholder")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("campaignType")}</label>
              <select
                value={aiForm.campaign_type}
                onChange={(e) => setAiForm((f) => ({ ...f, campaign_type: e.target.value as Campaign["campaign_type"] }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="email_drip">{t("email")}</option>
                <option value="social">{t("social")}</option>
                <option value="ads">{t("ads")}</option>
                <option value="multi_channel">{t("multi")}</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("targetAudience")}</label>
              <input
                type="text"
                value={aiForm.target_audience}
                onChange={(e) => setAiForm((f) => ({ ...f, target_audience: e.target.value }))}
                placeholder={t("targetAudiencePlaceholder")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("budget")} ($)</label>
                <input
                  type="number"
                  min="0"
                  value={aiForm.budget}
                  onChange={(e) => setAiForm((f) => ({ ...f, budget: e.target.value }))}
                  placeholder="1000"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("duration")} ({t("days")})</label>
                <input
                  type="number"
                  min="1"
                  value={aiForm.duration_days}
                  onChange={(e) => setAiForm((f) => ({ ...f, duration_days: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={aiGenerating}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {aiGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("generating")}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {t("generateWithAI")}
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Manual Form */}
        {createMode === "manual" && (
          <form onSubmit={handleManualCreate} className="space-y-4">
            {manualError && (
              <div className="flex items-center gap-2 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {manualError}
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("campaignName")}</label>
              <input
                type="text"
                required
                value={manualForm.name}
                onChange={(e) => setManualForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("campaignType")}</label>
              <select
                value={manualForm.campaign_type}
                onChange={(e) => setManualForm((f) => ({ ...f, campaign_type: e.target.value as ManualForm["campaign_type"] }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="email_drip">{t("email")}</option>
                <option value="social">{t("social")}</option>
                <option value="ads">{t("ads")}</option>
                <option value="multi_channel">{t("multi")}</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("startDate")}</label>
                <input
                  type="date"
                  value={manualForm.start_date}
                  onChange={(e) => setManualForm((f) => ({ ...f, start_date: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">{t("endDate")}</label>
                <input
                  type="date"
                  value={manualForm.end_date}
                  onChange={(e) => setManualForm((f) => ({ ...f, end_date: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={manualSubmitting}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {manualSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("createCampaign")}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
