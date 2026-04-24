"use client";

import { useEffect, useState } from "react";
import DashboardHeader from "@/components/DashboardHeader";
import { Skeleton } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/components/Toaster";
import { useConfirm } from "@/components/ConfirmDialog";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "next-intl";
import { Shield, ShieldAlert, LogIn, LogOut, Pencil, Trash2, Plus, Download } from "lucide-react";

interface AuditEntry {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown>;
  created_at: string | null;
}

function pickIcon(action: string) {
  const a = action.toLowerCase();
  if (a.includes("login")) return LogIn;
  if (a.includes("logout")) return LogOut;
  if (a.includes("delete")) return Trash2;
  if (a.includes("update") || a.includes("edit")) return Pencil;
  if (a.includes("create") || a.includes("add")) return Plus;
  if (a.includes("fail") || a.includes("denied")) return ShieldAlert;
  return Shield;
}

function relTime(iso: string | null, isAr: boolean): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return isAr ? "الآن" : "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return isAr ? `منذ ${m} دقيقة` : `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return isAr ? `منذ ${h} ساعة` : `${h} hr ago`;
  const d = Math.floor(h / 24);
  return isAr ? `منذ ${d} يوم` : `${d} days ago`;
}

export default function SecurityPage() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const toast = useToast();
  const confirm = useConfirm();

  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const rows = await api.get<AuditEntry[]>("/api/v1/auth/me/audit-log");
        setEntries(rows);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : isAr ? "فشل التحميل" : "Failed to load");
        setEntries([]);
      }
    })();
  }, [isAr]);

  const exportData = async () => {
    try {
      const data = await api.get<unknown>("/api/v1/auth/me/data-export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ignify-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(isAr ? "تم تنزيل بياناتك" : "Your data was downloaded");
    } catch (e) {
      toast.error(
        isAr ? "فشل التصدير" : "Export failed",
        e instanceof ApiError ? e.message : undefined
      );
    }
  };

  const deleteAccount = async () => {
    const ok = await confirm({
      title: isAr ? "حذف الحساب" : "Delete account",
      description: isAr
        ? "هذا الإجراء سيعطّل حسابك ويحذف بياناتك خلال 7 أيام. هل تريد المتابعة؟"
        : "This will disable your account and delete your data within 7 days. Proceed?",
      kind: "danger",
      confirmLabel: isAr ? "متابعة" : "Proceed",
      cancelLabel: isAr ? "إلغاء" : "Cancel",
    });
    if (!ok) return;

    const pwd = window.prompt(
      isAr ? "أدخل كلمة مرورك للتأكيد:" : "Enter your password to confirm:"
    );
    if (!pwd) return;
    const phrase = window.prompt(
      isAr ? "اكتب 'حذف' للتأكيد النهائي:" : "Type 'DELETE' for final confirmation:"
    );
    if (!phrase) return;

    try {
      await api.delete("/api/v1/auth/me", { current_password: pwd, confirm_phrase: phrase });
      toast.success(isAr ? "تم إغلاق حسابك" : "Account closed");
      setTimeout(() => (window.location.href = "/login"), 1500);
    } catch (e) {
      toast.error(
        isAr ? "فشل الحذف" : "Delete failed",
        e instanceof ApiError ? e.message : undefined
      );
    }
  };

  return (
    <div>
      <DashboardHeader title={isAr ? "الأمان والخصوصية" : "Security & Privacy"} />

      <div className="px-4 pb-12 pt-2 md:px-8">
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="rounded-3xl bg-surface-container-lowest p-6 shadow-soft">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-base font-bold text-on-surface">
                  {isAr ? "تصدير بياناتي" : "Export my data"}
                </h3>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {isAr
                    ? "حمّل نسخة JSON من جميع خططك ومحتواك وبيانات حسابك."
                    : "Download a JSON snapshot of all your plans, content, and account data."}
                </p>
              </div>
              <button
                onClick={exportData}
                className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-surface-container-highest px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-variant"
              >
                <Download className="h-4 w-4" />
                {isAr ? "تصدير" : "Export"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl bg-surface-container-lowest p-6 shadow-soft">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-base font-bold text-red-600 dark:text-red-400">
                  {isAr ? "حذف الحساب" : "Delete account"}
                </h3>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {isAr
                    ? "سيتم تعطيل الحساب فوراً، ويُحذف نهائياً بعد 7 أيام."
                    : "Account is disabled immediately, fully deleted after 7 days."}
                </p>
              </div>
              <button
                onClick={deleteAccount}
                className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4" />
                {isAr ? "حذف" : "Delete"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl bg-surface-container-lowest p-6 shadow-soft">
            <div className="mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h3 className="text-base font-bold text-on-surface">
                {isAr ? "سجل النشاط" : "Activity log"}
              </h3>
              <span className="text-xs text-on-surface-variant">
                {isAr ? "آخر 100 إجراء" : "last 100 actions"}
              </span>
            </div>

            {entries === null && !error && (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" rounded="xl" />
                ))}
              </div>
            )}

            {entries && entries.length === 0 && !error && (
              <EmptyState
                icon={Shield}
                title={isAr ? "لا توجد سجلات بعد" : "No activity yet"}
                description={
                  isAr
                    ? "سيتم تسجيل الإجراءات المهمة هنا تلقائياً."
                    : "Important actions will be logged here automatically."
                }
              />
            )}

            {entries && entries.length > 0 && (
              <ul className="divide-y divide-outline/10">
                {entries.map((entry) => {
                  const Icon = pickIcon(entry.action);
                  return (
                    <li key={entry.id} className="flex items-start gap-3 py-3">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-on-surface-variant" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-on-surface">{entry.action}</p>
                        {(entry.resource_type || entry.resource_id) && (
                          <p className="mt-0.5 text-[11px] text-on-surface-variant/70">
                            {entry.resource_type}
                            {entry.resource_id ? ` · ${entry.resource_id.slice(0, 8)}` : ""}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] text-on-surface-variant/70">
                        {relTime(entry.created_at, isAr)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            {error && (
              <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
