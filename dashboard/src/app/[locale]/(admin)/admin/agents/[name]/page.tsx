"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Workflow } from "lucide-react";
import { api } from "@/lib/api";

interface AgentGraphResponse {
  name: string;
  mermaid: string;
  nodes: string[];
  edges: { source: string; target: string; conditional?: boolean }[];
}

interface RunItem {
  id: string;
  agent_name: string;
  status: string;
  started_at: string;
  latency_ms: number | null;
  cost_usd: number | null;
  tenant_name: string | null;
}

/**
 * Simple dependency-free SVG layout for the graph: top-down, one node per row.
 * Works without mermaid.js installed.
 */
function GraphSVG({
  nodes,
  edges,
}: {
  nodes: string[];
  edges: { source: string; target: string; conditional?: boolean }[];
}) {
  const rowH = 70;
  const nodeW = 180;
  const nodeH = 40;
  const pad = 30;
  const width = nodeW + pad * 2;
  const height = nodes.length * rowH + pad * 2;

  const positions = useMemo(() => {
    const m: Record<string, { x: number; y: number }> = {};
    nodes.forEach((n, i) => {
      m[n] = { x: pad, y: pad + i * rowH };
    });
    return m;
  }, [nodes]);

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="max-h-[600px]">
      <defs>
        <marker
          id="arrow"
          viewBox="0 -5 10 10"
          refX="10"
          refY="0"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0,-5L10,0L0,5" fill="currentColor" />
        </marker>
      </defs>
      {edges.map((e, i) => {
        const from = positions[e.source];
        const to = positions[e.target];
        if (!from || !to) return null;
        const x1 = from.x + nodeW / 2;
        const y1 = from.y + nodeH;
        const x2 = to.x + nodeW / 2;
        const y2 = to.y;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeOpacity="0.5"
            strokeWidth="1.5"
            strokeDasharray={e.conditional ? "4 4" : undefined}
            markerEnd="url(#arrow)"
          />
        );
      })}
      {nodes.map((n) => {
        const p = positions[n];
        const isStart = n === "__start__";
        const isEnd = n === "__end__";
        const fill = isStart || isEnd ? "var(--color-accent, #a855f7)" : "var(--color-primary, #f97316)";
        return (
          <g key={n} transform={`translate(${p.x}, ${p.y})`}>
            <rect
              width={nodeW}
              height={nodeH}
              rx={8}
              ry={8}
              fill={fill}
              fillOpacity="0.1"
              stroke={fill}
              strokeWidth="1.5"
            />
            <text
              x={nodeW / 2}
              y={nodeH / 2 + 5}
              textAnchor="middle"
              fontSize="13"
              fontWeight="500"
              fill="currentColor"
            >
              {n}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function AdminAgentGraphPage() {
  const t = useTranslations("adminAgents");
  const params = useParams();
  const name = params?.name as string;

  const [graph, setGraph] = useState<AgentGraphResponse | null>(null);
  const [runs, setRuns] = useState<RunItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!name) return;
    Promise.all([
      api.get<AgentGraphResponse>(`/api/v1/admin/agents/${name}/graph`),
      api.get<RunItem[]>(`/api/v1/admin/agent-runs?agent_name=${name}&limit=10`),
    ])
      .then(([g, r]) => {
        setGraph(g);
        setRuns(r);
      })
      .catch((e) => setError(e?.message ?? "Failed"))
      .finally(() => setLoading(false));
  }, [name]);

  return (
    <div>
      <div className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface px-6">
        <Link
          href="/admin/agents"
          className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("graph.back")}
        </Link>
        <div className="flex items-center gap-2">
          <Workflow className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold capitalize text-text-primary">{name}</h1>
        </div>
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
        ) : graph ? (
          <>
            <section className="rounded-xl border border-border bg-surface p-5">
              <h2 className="mb-4 text-sm font-semibold text-text-primary">Graph</h2>
              <div className="overflow-x-auto rounded-lg border border-border bg-background p-4 text-text-secondary">
                <GraphSVG nodes={graph.nodes} edges={graph.edges} />
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-text-muted">
                  Mermaid source
                </summary>
                <pre className="mt-2 overflow-auto rounded-md bg-background p-3 text-xs">
                  {graph.mermaid}
                </pre>
              </details>
            </section>

            <div className="grid gap-6 md:grid-cols-2">
              <section className="rounded-xl border border-border bg-surface p-5">
                <h2 className="mb-3 text-sm font-semibold text-text-primary">
                  {t("graph.nodes")}
                </h2>
                <ul className="space-y-1.5">
                  {graph.nodes.map((n) => (
                    <li
                      key={n}
                      className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-text-secondary"
                    >
                      {n}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-xl border border-border bg-surface p-5">
                <h2 className="mb-3 text-sm font-semibold text-text-primary">
                  {t("graph.edges")}
                </h2>
                <ul className="space-y-1.5">
                  {graph.edges.map((e, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-text-secondary"
                    >
                      <span>{e.source}</span>
                      <span className="text-text-muted">
                        {e.conditional ? "⤳" : "→"}
                      </span>
                      <span>{e.target}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <section className="rounded-xl border border-border bg-surface">
              <div className="border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold text-text-primary">
                  {t("graph.recentRuns")}
                </h2>
              </div>
              {runs.length === 0 ? (
                <div className="p-5 text-center text-sm text-text-muted">
                  {t("list.empty")}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-background/50 text-xs uppercase text-text-muted">
                    <tr>
                      <th className="px-5 py-2 text-start">Tenant</th>
                      <th className="px-5 py-2 text-start">Status</th>
                      <th className="px-5 py-2 text-end">Latency</th>
                      <th className="px-5 py-2 text-end">Cost</th>
                      <th className="px-5 py-2 text-end">Started</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-border last:border-0 hover:bg-background/30"
                      >
                        <td className="px-5 py-2">
                          <Link
                            href={`/admin/agent-runs/${r.id}`}
                            className="text-primary hover:underline"
                          >
                            {r.tenant_name ?? "—"}
                          </Link>
                        </td>
                        <td className="px-5 py-2">{r.status}</td>
                        <td className="px-5 py-2 text-end text-text-muted">
                          {r.latency_ms ?? "—"}
                        </td>
                        <td className="px-5 py-2 text-end">
                          {r.cost_usd != null ? `$${Number(r.cost_usd).toFixed(4)}` : "—"}
                        </td>
                        <td className="px-5 py-2 text-end text-text-muted">
                          {new Date(r.started_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
