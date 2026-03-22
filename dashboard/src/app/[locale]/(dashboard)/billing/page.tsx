"use client";

import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import DataTable, { Column } from "@/components/DataTable";
import { CreditCard, Coins, ShoppingCart, Crown } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const usageData = [
  { name: "Week 1", credits: 120 },
  { name: "Week 2", credits: 180 },
  { name: "Week 3", credits: 150 },
  { name: "Week 4", credits: 220 },
  { name: "Week 5", credits: 190 },
  { name: "Week 6", credits: 280 },
  { name: "Week 7", credits: 240 },
  { name: "Week 8", credits: 310 },
];

interface Transaction {
  date: string;
  type: string;
  amount: string;
  status: string;
  [key: string]: unknown;
}

const mockTransactions: Transaction[] = [
  { date: "2026-03-20", type: "Credit Purchase", amount: "$49.00", status: "Completed" },
  { date: "2026-03-15", type: "Plan Upgrade", amount: "$99.00", status: "Completed" },
  { date: "2026-03-01", type: "Monthly Subscription", amount: "$49.00", status: "Completed" },
  { date: "2026-02-15", type: "Credit Purchase", amount: "$29.00", status: "Completed" },
  { date: "2026-02-01", type: "Monthly Subscription", amount: "$49.00", status: "Completed" },
  { date: "2026-01-20", type: "Credit Purchase", amount: "$49.00", status: "Refunded" },
];

export default function BillingPage() {
  const t = useTranslations("billingPage");

  const columns: Column<Transaction>[] = [
    { key: "date", label: t("transactionDate"), sortable: true },
    { key: "type", label: t("transactionType") },
    { key: "amount", label: t("amount"), sortable: true },
    {
      key: "status",
      label: t("transactionStatus"),
      render: (item) => (
        <span
          className={
            item.status === "Completed"
              ? "rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success"
              : "rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning"
          }
        >
          {item.status}
        </span>
      ),
    },
  ];

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        {/* Plan and Credits */}
        <div className="mb-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {/* Current Plan */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <Crown className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-text-secondary">{t("currentPlan")}</p>
                <p className="text-xl font-bold text-text-primary">{t("pro")}</p>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-background px-4 py-3">
              <p className="text-sm text-text-secondary">$49/month</p>
              <p className="text-xs text-text-muted">Next billing: April 1, 2026</p>
            </div>
          </div>

          {/* Credit Balance */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent/10 p-2.5">
                <Coins className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-text-secondary">{t("creditBalance")}</p>
                <p className="text-xl font-bold text-text-primary">1,250 {t("credits")}</p>
              </div>
            </div>
            <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary-dark">
              <ShoppingCart className="h-4 w-4" />
              {t("buyCredits")}
            </button>
          </div>

          {/* Payment Method */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-info/10 p-2.5">
                <CreditCard className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-sm text-text-secondary">Payment Method</p>
                <p className="text-sm font-medium text-text-primary">Visa ending in 4242</p>
              </div>
            </div>
            <button className="mt-4 w-full rounded-lg border border-border py-2.5 text-sm font-medium text-text-secondary hover:bg-surface-hover">
              Update Payment Method
            </button>
          </div>
        </div>

        {/* Usage Chart */}
        <div className="mb-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-text-primary">{t("usage")}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={usageData}>
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
                  name="Credits Used"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Transaction History */}
        <h3 className="mb-4 text-lg font-semibold text-text-primary">{t("transactionHistory")}</h3>
        <DataTable
          columns={columns}
          data={mockTransactions as unknown as Record<string, unknown>[]}
        />
      </div>
    </div>
  );
}
