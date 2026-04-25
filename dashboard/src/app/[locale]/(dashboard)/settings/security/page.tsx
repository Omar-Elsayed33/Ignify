"use client";

import { useEffect, useRef, useState } from "react";
import DashboardHeader from "@/components/DashboardHeader";
import { Skeleton } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/components/Toaster";
import { useConfirm } from "@/components/ConfirmDialog";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "next-intl";
import * as Dialog from "@radix-ui/react-dialog";
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

  // Delete-account confirmation modal state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePwd, setDeletePwd] = useState("");
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deleting, setDeleting] = useState(false);
  const pwdInputRef = useRef<HTMLInputElement>(null);

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
    setDeletePwd("");
    setDeletePhrase("");
    setDeleteOpen(true);
  };

  const submitDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const expectedPhrase = isAr ? "حذف" : "DELETE";
    if (deletePhrase !== expectedPhrase) {
      toast.error(
        isAr ? `اكتب "${expectedPhrase}" للتأكيد` : `Type "${expectedPhrase}" to confirm`
      );
      return;
    }
    setDeleting(true);
    try {
      await api.delete("/api/v1/auth/me", {
        current_password: deletePwd,
        confirm_phrase: deletePhrase,
      });
      setDeleteOpen(false);
      toast.success(isAr ? "تم إغلاق حسابك" : "Account closed");
      setTimeout(() => (window.location.href = "/login"), 1500);
    } catch (e) {
      toast.error(
        isAr ? "فشل الحذف" : "Delete failed",
        e instanceof ApiError ? e.message : undefined
      );
    } finally {
      setDeleting(false);
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

      {/* Delete-account confirmation modal */}
      <Dialog.Root
        open={deleteOpen}
        onOpenChange={(o) => {
          if (!o && !deleting) setDeleteOpen(false);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content
            className="fixed start-1/2 top-1/2 z-[100] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-surface-container-lowest p-6 shadow-[0_8px_30px_rgba(0,0,0,0.2)] ring-1 ring-outline/10 rtl:translate-x-1/2 data-[state=open]:animate-in data-[state=open]:zoom-in-95"
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              pwdInputRef.current?.focus();
            }}
          >
            <Dialog.Title className="text-base font-bold text-red-600">
              {isAr ? "تأكيد حذف الحساب" : "Confirm account deletion"}
            </Dialog.Title>
            <Dialog.Description className="mt-1.5 text-sm text-on-surface-variant">
              {isAr
                ? `أدخل كلمة مرورك ثم اكتب "حذف" للتأكيد النهائي.`
                : `Enter your password, then type "DELETE" to confirm.`}
            </Dialog.Description>
            <form className="mt-4 space-y-3" onSubmit={submitDeleteAccount}>
              <input
                ref={pwdInputRef}
                type="password"
                value={deletePwd}
                onChange={(e) => setDeletePwd(e.target.value)}
                placeholder={isAr ? "كلمة المرور" : "Password"}
                required
                className="w-full rounded-2xl border border-outline/30 bg-surface-container-high px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              <input
                type="text"
                value={deletePhrase}
                onChange={(e) => setDeletePhrase(e.target.value)}
                placeholder={isAr ? 'اكتب "حذف"' : 'Type "DELETE"'}
                required
                className="w-full rounded-2xl border border-outline/30 bg-surface-container-high px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeleteOpen(false)}
                  className="rounded-2xl bg-surface-container-highest px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-variant disabled:opacity-50"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={deleting || !deletePwd || deletePhrase !== (isAr ? "حذف" : "DELETE")}
                  className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting
                    ? isAr ? "جارٍ الحذف…" : "Deleting…"
                    : isAr ? "حذف حسابي" : "Delete my account"}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
