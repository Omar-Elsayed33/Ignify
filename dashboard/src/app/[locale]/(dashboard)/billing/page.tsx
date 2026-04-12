"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import DataTable, { Column } from "@/components/DataTable";
import { Coins, Loader2, ShoppingCart, TrendingDown, TrendingUp } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────

interface BalanceResponse {
  tenant_id: string;
  balance: number;
  updated_at: string;
}

interface CreditTransaction {
  id: string;
  tenant_id: string;
  action_type: string;
  credits_used: number;
  description: string | null;
  created_at: string;
  [key: string]: unknown;
}

interface UsageSummary {
  total_credits_used: number;
  total_credits_purchased: number;
  current_balance: number;
  transaction_count: number;
}

// ── Chart helpers ─────────────────────────────────────────────────────────────

function buildChartData(transactions: CreditTransaction[]) {
  // Group by date, sum absolute credits used
  const byDate: Record<string, number> = {};
  transactions.forEach((tx) => {
    const date = tx.created_at.split("T")[0];
    byDate[date] = (byDate[date] ?? 0) + Math.abs(tx.credits_used);
  });
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([date, credits]) => ({ name: date, credits }));
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const t = useTranslations("billingPage");

  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buy credits modal state
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyCredits, setBuyCredits] = useState(500);
  const [buyAmount, setBuyAmount] = useState(49);
  const [buyRef, setBuyRef] = useState("");
  const [purchasing, setPurchasing] = useState(false);

  // ── Fetch all billing data ────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [bal, txs, usg] = await Promise.all([
          api.get<BalanceResponse>("/api/v1/billing/balance"),
          api.get<CreditTransaction[]>("/api/v1/billing/transactions"),
          api.get<UsageSummary>("/api/v1/billing/usage"),
        ]);
        setBalance(bal);
        setTransactions(txs);
        setUsage(usg);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load billing data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Purchase handler ──────────────────────────────────────────────────────

  async function handlePurchase(e: React.FormEvent) {
    e.preventDefault();
    try {
      setPurchasing(true);
      await api.post("/api/v1/billing/purchase", {
        amount: buyAmount,
        credits: buyCredits,
        payment_ref: buyRef || null,
      });
      // Refresh balance and transactions
      const [bal, txs, usg] = await Promise.all([
        api.get<BalanceResponse>("/api/v1/billing/balance"),
        api.get<CreditTransaction[]>("/api/v1/billing/transactions"),
        api.get<UsageSummary>("/api/v1/billing/usage"),
      ]);
      setBalance(bal);
      setTransactions(txs);
      setUsage(usg);
      setBuyOpen(false);
      setBuyRef("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setPurchasing(false);
    }
  }

  // ── Columns ───────────────────────────────────────────────────────────────

  const columns: Column<CreditTransaction>[] = [
    {
      key: "created_at",
      label: t("transactionDate"),
      sortable: true,
      render: (item) => (
        <span>{new Date(item.created_at).toLocaleDateString()}</span>
      ),
    },
    {
      key: "action_type",
      label: t("transactionType"),
      render: (item) => (
        <span className="capitalize">{item.action_type.replace(/_/g, " ")}</span>
      ),
    },
    {
      key: "credits_used",
      label: t("amount"),
      sortable: true,
      render: (item) => (
        <span
          className={
            item.credits_used < 0
              ? "font-medium text-success"
              : "font-medium text-error"
          }
        >
          {item.credits_used < 0 ? "+" : ""}
          {Math.abs(item.credits_used)} {t("credits")}
        </span>
      ),
    },
    {
      key: "description",
      label: t("transactionStatus"),
      render: (item) => (
        <span className="text-sm text-text-secondary">
          {item.description ?? "—"}
        </span>
      ),
    },
  ];

  // ── Loading / error ───────────────────────────────────────────────────────

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
        <div className="p-6">
          <p className="text-sm text-error">{error}</p>
        </div>
      </div>
    );
  }

  const chartData = buildChartData(transactions);

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        {/* Stats */}
        <div className="mb-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {/* Current Balance */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent/10 p-2.5">
                <Coins className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-text-secondary">{t("creditBalance")}</p>
                <p className="text-xl font-bold text-text-primary">
                  {(balance?.balance ?? 0).toLocaleString()} {t("credits")}
                </p>
              </div>
            </div>
            <button
              onClick={() => setBuyOpen(true)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
            >
              <ShoppingCart className="h-4 w-4" />
              {t("buyCredits")}
            </button>
          </div>

          {/* Total Purchased */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-success/10 p-2.5">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-text-secondary">{t("totalPurchased")}</p>
                <p className="text-xl font-bold text-text-primary">
                  {(usage?.total_credits_purchased ?? 0).toLocaleString()} {t("credits")}
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-background px-4 py-3">
              <p className="text-xs text-text-muted">
                {usage?.transaction_count ?? 0} {t("transactions")}
              </p>
            </div>
          </div>

          {/* Total Used */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-error/10 p-2.5">
                <TrendingDown className="h-5 w-5 text-error" />
              </div>
              <div>
                <p className="text-sm text-text-secondary">{t("totalUsed")}</p>
                <p className="text-xl font-bold text-text-primary">
                  {(usage?.total_credits_used ?? 0).toLocaleString()} {t("credits")}
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-background px-4 py-3">
              <p className="text-xs text-text-muted">
                {t("balance")}: {(usage?.current_balance ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Usage Chart */}
        <div className="mb-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-text-primary">
            {t("usage")}
          </h3>
          {chartData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-text-muted">
              {t("noUsageData")}
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={12} />
                  <YAxis stroke="#94A3B8" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #E2E8F0",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="credits"
                    stroke="#FF6B00"
                    fill="#FF6B00"
                    fillOpacity={0.1}
                    strokeWidth={2}
                    name={t("credits")}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Transaction History */}
        <h3 className="mb-4 text-lg font-semibold text-text-primary">
          {t("transactionHistory")}
        </h3>
        {transactions.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-10 text-center text-sm text-text-muted">
            {t("noTransactions")}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={transactions as unknown as Record<string, unknown>[]}
          />
        )}
      </div>

      {/* Buy Credits Modal */}
      {buyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
            <h2 className="mb-5 text-lg font-semibold text-text-primary">
              {t("buyCredits")}
            </h2>
            <form onSubmit={handlePurchase} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">
                  {t("credits")}
                </label>
                <input
                  type="number"
                  min={1}
                  value={buyCredits}
                  onChange={(e) => setBuyCredits(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">
                  {t("amount")} ($)
                </label>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">
                  {t("paymentRef")}
                </label>
                <input
                  type="text"
                  value={buyRef}
                  onChange={(e) => setBuyRef(e.target.value)}
                  placeholder="Optional reference"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBuyOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={purchasing}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
                >
                  {purchasing && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("confirm")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
