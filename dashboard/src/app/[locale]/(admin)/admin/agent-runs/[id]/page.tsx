"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { clsx } from "clsx";
import { ArrowLeft, CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";

type Trace = {
  node: string;
  started_at: number | null;
  finished_at: number | null;
  duration_ms: number | null;
  input_keys: string[];
  output_keys: string[];
  tokens_in: number;
  tokens_out: number;
  cost: number;
  status: string;
  error: string | null;
  input?: unknown;
  output?: unknown;
};

interface RunDetail {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  agent_name: string;
  model: string | null;
  status: string;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  traces: Trace[];
  error: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  latency_ms: number | null;
  started_at: string;
  finished_at: string | null;
}

const KNOWN_STATUSES = ["pending", "running", "succeeded", "failed", "skipped"] as const;

function StatusPill({ status }: { status: string }) {
  const t = useTranslations("agentTrace.status");
  const cls = clsx(
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
    status === "succeeded" || status === "success"
      ? "bg-success/10 text-success"
      : status === "failed" || status === "error"
      ? "bg-error/10 text-error"
      : status === "running"
      ? "bg-warning/10 text-warning"
      : "bg-background text-text-muted"
  );
  const Icon =
    status === "succeeded" || status === "success"
      ? CheckCircle2
      : status === "failed" || status === "error"
      ? XCircle
      : Clock;
  return (
    <span className={cls}>
      <Icon className="h-3 w-3" />
      {(KNOWN_STATUSES as readonly string[]).includes(status) ? t(status) : status}
    </span>
  );
}

function JsonBlock({ data }: { data: unknown }) {
  const text = useMemo(() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);
  return (
    <pre className="max-h-[500px] overflow-auto rounded-lg border border-border bg-background p-3 text-xs text-text-secondary">
      {text}
    </pre>
  );
}

function TimelineRow({ trace, maxDur }: { trace: Trace; maxDur: number }) {
  const tt = useTranslations("agentTrace.columns");
  const [open, setOpen] = useState(false);
  const durPct = trace.duration_ms && maxDur > 0 ? (trace.duration_ms / maxDur) * 100 : 0;
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-5 py-3 text-sm hover:bg-background/30"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-text-muted" />
        ) : (
          <ChevronRight className="h-4 w-4 text-text-muted" />
        )}
        <span className="w-40 truncate text-start font-medium text-text-primary">
          {trace.node}
        </span>
        <div className="flex flex-1 items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-background">
            <div
              className="h-full bg-primary"
              style={{ width: `${Math.max(durPct, 2)}%` }}
            />
          </div>
          <span className="w-20 text-end text-xs text-text-muted">
            {trace.duration_ms ?? 0} ms
          </span>
        </div>
        <span className="w-28 text-end text-xs text-text-muted">
          {trace.tokens_in + trace.tokens_out > 0
            ? `${trace.tokens_in}/${trace.tokens_out}`
            : "—"}
        </span>
        <span className="w-20 text-end text-xs text-text-muted">
          {trace.cost > 0 ? `$${trace.cost.toFixed(4)}` : "—"}
        </span>
        <span className="w-24 text-end">
          <StatusPill status={trace.status} />
        </span>
      </button>
      {open && (
        <div className="space-y-2 bg-background/40 px-5 py-3 text-xs">
          <div>
            <span className="font-semibold text-text-secondary">{tt("node")}:</span>{" "}
            <span className="text-text-muted">{trace.node}</span>
          </div>
          {trace.input_keys.length > 0 && (
            <div>
              <span className="font-semibold text-text-secondary">Input keys:</span>{" "}
              <span className="text-text-muted">{trace.input_keys.join(", ")}</span>
            </div>
          )}
          {trace.output_keys.length > 0 && (
            <div>
              <span className="font-semibold text-text-secondary">Output keys:</span>{" "}
              <span className="text-text-muted">{trace.output_keys.join(", ")}</span>
            </div>
          )}
          {trace.error && (
            <div className="rounded-md border border-error/30 bg-error/10 p-2 text-error">
              {trace.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type Tab = "timeline" | "input" | "output" | "error";

export default function AgentRunDetailPage() {
  const t = useTranslations("agentTrace");
  const params = useParams();
  const id = params?.id as string;

  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("timeline");

  useEffect(() => {
    if (!id) return;
    api
      .get<RunDetail>(`/api/v1/admin/agent-runs/${id}`)
      .then(setRun)
      .catch((e) => setError(e?.message ?? "Failed"))
      .finally(() => setLoading(false));
  }, [id]);

  const maxDur = useMemo(() => {
    if (!run) return 0;
    return run.traces.reduce((m, tr) => Math.max(m, tr.duration_ms ?? 0), 0);
  }, [run]);

  const hasError = run?.status === "failed" || !!run?.error;

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "timeline", label: t("tabs.timeline"), show: true },
    { key: "input", label: t("tabs.input"), show: true },
    { key: "output", label: t("tabs.output"), show: true },
    { key: "error", label: t("tabs.error"), show: hasError },
  ];

  return (
    <div>
      <div className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface px-6">
        <Link
          href="/admin/dashboard"
          className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold text-text-primary">{t("title")}</h1>
      </div>

      <div className="space-y-6 p-6">
        {error && (
          <div className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : run ? (
          <>
            {/* Header card */}
            <div className="grid gap-4 rounded-xl border border-border bg-surface p-5 md:grid-cols-5">
              <div>
                <p className="text-xs uppercase text-text-muted">Agent</p>
                <Link
                  href={`/admin/agents/${run.agent_name}`}
                  className="text-lg font-semibold capitalize text-primary hover:underline"
                >
                  {run.agent_name}
                </Link>
                <p className="text-xs text-text-muted">{run.model ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-text-muted">Tenant</p>
                <p className="text-sm font-medium text-text-primary">
                  {run.tenant_name ?? run.tenant_id}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-text-muted">Status</p>
                <StatusPill status={run.status} />
              </div>
              <div>
                <p className="text-xs uppercase text-text-muted">{t("totals.cost")}</p>
                <p className="text-sm font-medium text-text-primary">
                  {run.cost_usd != null ? `$${Number(run.cost_usd).toFixed(4)}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-text-muted">{t("totals.latency")}</p>
                <p className="text-sm font-medium text-text-primary">
                  {run.latency_ms != null ? `${run.latency_ms} ms` : "—"}
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="rounded-xl border border-border bg-surface">
              <div className="flex gap-1 border-b border-border px-3">
                {tabs
                  .filter((x) => x.show)
                  .map((x) => (
                    <button
                      key={x.key}
                      onClick={() => setTab(x.key)}
                      className={clsx(
                        "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                        tab === x.key
                          ? "border-primary text-primary"
                          : "border-transparent text-text-muted hover:text-text-primary"
                      )}
                    >
                      {x.label}
                    </button>
                  ))}
              </div>

              <div className="p-5">
                {tab === "timeline" &&
                  (run.traces.length === 0 ? (
                    <p className="text-center text-sm text-text-muted">{t("empty")}</p>
                  ) : (
                    <div className="rounded-lg border border-border">
                      <div className="flex items-center gap-3 border-b border-border bg-background/50 px-5 py-2 text-xs uppercase text-text-muted">
                        <span className="w-4" />
                        <span className="w-40 text-start">{t("columns.node")}</span>
                        <span className="flex-1 text-start">{t("columns.duration")}</span>
                        <span className="w-28 text-end">{t("columns.tokens")}</span>
                        <span className="w-20 text-end">{t("columns.cost")}</span>
                        <span className="w-24 text-end">{t("columns.status")}</span>
                      </div>
                      {run.traces.map((tr, i) => (
                        <TimelineRow key={i} trace={tr} maxDur={maxDur} />
                      ))}
                    </div>
                  ))}

                {tab === "input" && <JsonBlock data={run.input ?? {}} />}
                {tab === "output" && <JsonBlock data={run.output ?? {}} />}
                {tab === "error" && (
                  <pre className="max-h-[500px] overflow-auto rounded-lg border border-error/30 bg-error/10 p-3 text-xs text-error">
                    {run.error ?? "Unknown error"}
                  </pre>
                )}
              </div>
            </div>

            <div>
              <Link
                href={`/admin/agents/${run.agent_name}`}
                className="text-sm text-primary hover:underline"
              >
                ← {t("backToAgent")}
              </Link>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
