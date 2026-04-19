"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toaster";
import {
  CheckCircle,
  X,
  Clock,
  Loader2,
  RefreshCw,
  Filter,
} from "lucide-react";

interface OfflinePayment {
  id: string;
  tenant_id: string;
  tenant_name: string;
  plan_id: string | null;
  plan_name: string | null;
  amount: number;
  currency: string;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  status: string;
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface Plan { code: string; name_en: string; }
const PLANS: Plan[] = [];

export default function AdminPaymentsPage() {
  const locale = useLocale();
  const toast = useToast();
  const [payments, setPayments] = useState<OfflinePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [actionId, setActionId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [planOverride, setPlanOverride] = useState("");
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);

  async function load(status?: string) {
    setLoading(true);
    try {
      const q = status ?? filter;
      const data = await api.get<OfflinePayment[]>(
        `/api/v1/admin/payments/offline${q ? `?status_filter=${q}` : ""}`
      );
      setPayments(data);
    } catch {
      toast.error("Failed to load payments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.get<Plan[]>("/api/v1/billing/plans").then((p) => {
      setAvailablePlans(p ?? []);
      if (p?.length) setPlanOverride(p[0].code);
    }).catch(() => {});
  }, []);

  useEffect(() => { load(filter); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function approve(id: string) {
    setActionId(id);
    try {
      await api.post(`/api/v1/admin/payments/offline/${id}/approve`, {
        admin_notes: adminNotes || null,
      });
      toast.success(locale === "ar" ? "تمت الموافقة" : "Payment approved");
      setSelectedId(null);
      setAdminNotes("");
      await load(filter);
    } catch (e) {
      toast.error("Failed", e instanceof Error ? e.message : "");
    } finally {
      setActionId(null);
    }
  }

  async function reject(id: string) {
    setActionId(id);
    try {
      await api.post(`/api/v1/admin/payments/offline/${id}/reject`, {
        admin_notes: adminNotes || null,
      });
      toast.success(locale === "ar" ? "تم الرفض" : "Payment rejected");
      setSelectedId(null);
      setAdminNotes("");
      await load(filter);
    } catch (e) {
      toast.error("Failed", e instanceof Error ? e.message : "");
    } finally {
      setActionId(null);
    }
  }

  async function changePlan(tenantId: string) {
    setActionId(tenantId);
    try {
      await api.put(`/api/v1/admin/tenants/${tenantId}/plan`, {
        plan_code: planOverride,
        activate_subscription: true,
      });
      toast.success(locale === "ar" ? "تم تغيير الباقة" : "Plan changed");
    } catch (e) {
      toast.error("Failed", e instanceof Error ? e.message : "");
    } finally {
      setActionId(null);
    }
  }

  const statusIcon = (s: string) =>
    s === "approved" ? (
      <CheckCircle className="h-4 w-4 text-success" />
    ) : s === "rejected" ? (
      <X className="h-4 w-4 text-error" />
    ) : (
      <Clock className="h-4 w-4 text-warning" />
    );

  const statusBadge = (s: string) => {
    const base = "rounded-full px-2.5 py-0.5 text-xs font-medium";
    if (s === "approved") return `${base} bg-success/10 text-success`;
    if (s === "rejected") return `${base} bg-error/10 text-error`;
    return `${base} bg-warning/10 text-warning`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-on-surface">
          {locale === "ar" ? "مدفوعات يدوية" : "Offline Payments"}
        </h1>
        <button
          onClick={() => load(filter)}
          className="flex items-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm text-on-surface hover:bg-surface-container"
        >
          <RefreshCw className="h-4 w-4" />
          {locale === "ar" ? "تحديث" : "Refresh"}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {["pending", "approved", "rejected", ""].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              filter === s
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            {s === ""
              ? locale === "ar" ? "الكل" : "All"
              : s === "pending"
              ? locale === "ar" ? "قيد المراجعة" : "Pending"
              : s === "approved"
              ? locale === "ar" ? "موافق عليه" : "Approved"
              : locale === "ar" ? "مرفوض" : "Rejected"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : payments.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface-container-low p-12 text-center text-on-surface-variant">
          {locale === "ar" ? "لا توجد مدفوعات" : "No payments found"}
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-border bg-surface-container-low p-5"
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    {statusIcon(p.status)}
                    <span className="font-semibold text-on-surface">{p.tenant_name}</span>
                    <span className={statusBadge(p.status)}>
                      {p.status === "approved"
                        ? locale === "ar" ? "موافق" : "Approved"
                        : p.status === "rejected"
                        ? locale === "ar" ? "مرفوض" : "Rejected"
                        : locale === "ar" ? "قيد المراجعة" : "Pending"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    {p.plan_name ?? "—"} · {p.amount} {p.currency} · {p.payment_method.replace("_", " ")}
                    {p.reference_number && ` · Ref: ${p.reference_number}`}
                  </p>
                  {p.notes && (
                    <p className="mt-1 text-xs text-on-surface-variant">{p.notes}</p>
                  )}
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {new Date(p.created_at).toLocaleString()}
                  </p>
                  {p.admin_notes && (
                    <p className="mt-1 text-xs font-medium text-on-surface">
                      {locale === "ar" ? "ملاحظة الإدارة:" : "Admin note:"} {p.admin_notes}
                    </p>
                  )}
                </div>

                {/* Quick plan change */}
                <div className="flex items-center gap-2">
                  <select
                    value={planOverride}
                    onChange={(e) => setPlanOverride(e.target.value)}
                    className="rounded-xl border border-outline-variant bg-surface px-3 py-1.5 text-sm text-on-surface"
                  >
                    {availablePlans.map((pl) => (
                      <option key={pl.code} value={pl.code}>{pl.name_en}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => changePlan(p.tenant_id)}
                    disabled={actionId === p.tenant_id}
                    className="rounded-xl bg-surface-container px-3 py-1.5 text-xs font-medium text-on-surface hover:bg-surface-container-high disabled:opacity-60"
                  >
                    {actionId === p.tenant_id ? <Loader2 className="h-3 w-3 animate-spin" /> : locale === "ar" ? "تغيير الباقة" : "Set plan"}
                  </button>
                </div>
              </div>

              {/* Approve / reject actions (only for pending) */}
              {p.status === "pending" && (
                <div className="mt-3 border-t border-border pt-3">
                  {selectedId === p.id ? (
                    <div className="space-y-2">
                      <textarea
                        rows={2}
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder={locale === "ar" ? "ملاحظة للعميل (اختياري)" : "Note to customer (optional)"}
                        className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => approve(p.id)}
                          disabled={!!actionId}
                          className="flex items-center gap-1 rounded-xl bg-success px-4 py-2 text-sm font-medium text-on-success hover:opacity-90 disabled:opacity-60"
                        >
                          {actionId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                          {locale === "ar" ? "موافقة" : "Approve"}
                        </button>
                        <button
                          onClick={() => reject(p.id)}
                          disabled={!!actionId}
                          className="flex items-center gap-1 rounded-xl bg-error px-4 py-2 text-sm font-medium text-on-error hover:opacity-90 disabled:opacity-60"
                        >
                          <X className="h-4 w-4" />
                          {locale === "ar" ? "رفض" : "Reject"}
                        </button>
                        <button
                          onClick={() => { setSelectedId(null); setAdminNotes(""); }}
                          className="rounded-xl border border-border px-4 py-2 text-sm text-on-surface-variant"
                        >
                          {locale === "ar" ? "إلغاء" : "Cancel"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSelectedId(p.id)}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {locale === "ar" ? "مراجعة هذا الطلب" : "Review this request"}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
