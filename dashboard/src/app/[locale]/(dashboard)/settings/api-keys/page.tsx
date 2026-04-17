"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  Copy,
  Check,
  Key,
  Loader2,
  Plus,
  ShieldOff,
  Trash2,
  X,
} from "lucide-react";
import { clsx } from "clsx";

import DashboardHeader from "@/components/DashboardHeader";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import { useToast } from "@/components/Toaster";
import { useConfirm } from "@/components/ConfirmDialog";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

interface ApiKeyRecord {
  id: string;
  name: string;
  prefix: string;
  scope: "read" | "write";
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface CreateKeyResponse {
  key: string;
  record: ApiKeyRecord;
}

function relTime(iso: string | null, isAr: boolean): string {
  if (!iso) return isAr ? "—" : "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return isAr ? "الآن" : "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return isAr ? `منذ ${m} دقيقة` : `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return isAr ? `منذ ${h} ساعة` : `${h} hr ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return isAr ? `منذ ${d} يوم` : `${d} days ago`;
  const mo = Math.floor(d / 30);
  return isAr ? `منذ ${mo} شهر` : `${mo} mo ago`;
}

export default function ApiKeysPage() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuthStore();
  const role = user?.role;
  const canManage = role === "owner" || role === "admin";

  const [keys, setKeys] = useState<ApiKeyRecord[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canManage) {
      setKeys([]);
      return;
    }
    try {
      const rows = await api.get<ApiKeyRecord[]>("/api/v1/api-keys");
      setKeys(rows);
    } catch (e) {
      setKeys([]);
      toast.error(
        isAr ? "فشل تحميل المفاتيح" : "Failed to load keys",
        e instanceof ApiError ? e.message : undefined,
      );
    }
  }, [canManage, isAr, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRevoke = async (k: ApiKeyRecord) => {
    const ok = await confirm({
      title: isAr ? "إلغاء المفتاح" : "Revoke key",
      description: isAr
        ? `سيتوقّف "${k.name}" عن العمل فوراً ولا يمكن التراجع.`
        : `"${k.name}" will stop working immediately. This can't be undone.`,
      kind: "danger",
      confirmLabel: isAr ? "إلغاء المفتاح" : "Revoke",
      cancelLabel: isAr ? "إلغاء" : "Cancel",
    });
    if (!ok) return;
    setRevokingId(k.id);
    try {
      await api.delete(`/api/v1/api-keys/${k.id}`);
      toast.success(isAr ? "تم إلغاء المفتاح" : "Key revoked");
      await load();
    } catch (e) {
      toast.error(
        isAr ? "فشل الإلغاء" : "Revoke failed",
        e instanceof ApiError ? e.message : undefined,
      );
    } finally {
      setRevokingId(null);
    }
  };

  if (!canManage) {
    return (
      <div>
        <DashboardHeader title={isAr ? "مفاتيح API" : "API Keys"} />
        <div className="p-8">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-start gap-4 rounded-3xl bg-surface-container-lowest p-8 shadow-soft">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/30">
                <ShieldOff className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="font-headline text-lg font-bold text-on-surface">
                  {isAr ? "غير مسموح" : "Permission denied"}
                </h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {isAr
                    ? "فقط مالك المؤسسة أو المدير يمكنهم إدارة مفاتيح API."
                    : "Only owner or admin users can manage API keys."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasKeys = (keys?.length ?? 0) > 0;

  return (
    <div>
      <DashboardHeader title={isAr ? "مفاتيح API" : "API Keys"} />
      <div className="p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-headline text-2xl font-bold text-on-surface">
                {isAr ? "مفاتيح API" : "API Keys"}
              </h1>
              <p className="mt-1 max-w-xl text-sm text-on-surface-variant">
                {isAr
                  ? "أنشئ مفاتيح برمجية لوصول التطبيقات الخارجية."
                  : "Create programmatic keys for external access."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="brand-gradient inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-transform hover:scale-[1.02]"
            >
              <Plus className="h-4 w-4" />
              {isAr ? "إنشاء مفتاح" : "Create key"}
            </button>
          </div>

          <div className="rounded-3xl bg-surface-container-lowest p-1 shadow-soft">
            {keys === null ? (
              <div className="space-y-2 p-5">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            ) : !hasKeys ? (
              <div className="p-4">
                <EmptyState
                  icon={Key}
                  title={isAr ? "لا توجد مفاتيح بعد" : "No keys yet"}
                  description={
                    isAr
                      ? "أنشئ مفتاحك الأول لبدء استخدام الـ API."
                      : "Create your first key to start using the API."
                  }
                  actionLabel={isAr ? "إنشاء مفتاح" : "Create key"}
                  onAction={() => setCreating(true)}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-start text-xs uppercase tracking-wider text-on-surface-variant">
                    <tr>
                      <th className="px-5 py-3 text-start font-semibold">
                        {isAr ? "الاسم" : "Name"}
                      </th>
                      <th className="px-5 py-3 text-start font-semibold">
                        {isAr ? "البادئة" : "Prefix"}
                      </th>
                      <th className="px-5 py-3 text-start font-semibold">
                        {isAr ? "الصلاحية" : "Scope"}
                      </th>
                      <th className="px-5 py-3 text-start font-semibold">
                        {isAr ? "آخر استخدام" : "Last used"}
                      </th>
                      <th className="px-5 py-3 text-start font-semibold">
                        {isAr ? "تاريخ الإنشاء" : "Created"}
                      </th>
                      <th className="px-5 py-3 text-end font-semibold" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline/10">
                    {keys.map((k) => {
                      const revoked = !!k.revoked_at;
                      return (
                        <tr
                          key={k.id}
                          className={clsx(revoked && "opacity-50")}
                        >
                          <td className="px-5 py-3 font-medium text-on-surface">
                            {k.name}
                          </td>
                          <td className="px-5 py-3 font-mono text-xs text-on-surface-variant">
                            {k.prefix}…
                          </td>
                          <td className="px-5 py-3">
                            <ScopeChip scope={k.scope} isAr={isAr} />
                          </td>
                          <td className="px-5 py-3 text-on-surface-variant">
                            {k.last_used_at
                              ? relTime(k.last_used_at, isAr)
                              : isAr
                                ? "لم يُستخدم"
                                : "Never"}
                          </td>
                          <td className="px-5 py-3 text-on-surface-variant">
                            {relTime(k.created_at, isAr)}
                          </td>
                          <td className="px-5 py-3 text-end">
                            {revoked ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-highest px-2.5 py-0.5 text-xs font-semibold text-on-surface-variant">
                                {isAr ? "ملغى" : "Revoked"}
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={revokingId === k.id}
                                onClick={() => handleRevoke(k)}
                                className="inline-flex items-center gap-1 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-60 dark:text-red-400"
                              >
                                {revokingId === k.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                                {isAr ? "إلغاء" : "Revoke"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <CreateKeyDialog
        open={creating}
        onOpenChange={(o) => setCreating(o)}
        isAr={isAr}
        onCreated={async () => {
          await load();
        }}
      />
    </div>
  );
}

function ScopeChip({
  scope,
  isAr,
}: {
  scope: "read" | "write";
  isAr: boolean;
}) {
  const isWrite = scope === "write";
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        isWrite
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
          : "bg-primary/10 text-primary",
      )}
    >
      {isWrite
        ? isAr
          ? "قراءة وكتابة"
          : "Read + write"
        : isAr
          ? "قراءة فقط"
          : "Read-only"}
    </span>
  );
}

function CreateKeyDialog({
  open,
  onOpenChange,
  isAr,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAr: boolean;
  onCreated: () => Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"read" | "write">("read");
  const [submitting, setSubmitting] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setScope("read");
      setSubmitting(false);
      setSecret(null);
      setCopied(false);
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post<CreateKeyResponse>("/api/v1/api-keys", {
        name: name.trim(),
        scope,
      });
      setSecret(res.key);
      await onCreated();
    } catch (e) {
      toast.error(
        isAr ? "فشل إنشاء المفتاح" : "Failed to create key",
        e instanceof ApiError ? e.message : undefined,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const copy = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(isAr ? "فشل النسخ" : "Copy failed");
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed start-1/2 top-1/2 z-[100] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-surface-container-lowest p-6 shadow-[0_8px_30px_rgba(0,0,0,0.2)] ring-1 ring-outline/10 rtl:translate-x-1/2 data-[state=open]:animate-in data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between gap-2">
            <Dialog.Title className="font-headline text-lg font-bold text-on-surface">
              {secret
                ? isAr
                  ? "المفتاح الخاص بك"
                  : "Your new key"
                : isAr
                  ? "إنشاء مفتاح API"
                  : "Create API key"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="rounded-full p-1 text-on-surface-variant hover:bg-surface-container"
                aria-label={isAr ? "إغلاق" : "Close"}
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {!secret ? (
            <form onSubmit={submit} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  {isAr ? "اسم المفتاح" : "Key name"}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    isAr ? "مثال: Zapier integration" : "e.g. Zapier integration"
                  }
                  className="w-full rounded-xl bg-surface-container-low px-4 py-2.5 text-sm text-on-surface outline-none transition-all focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <fieldset className="space-y-2">
                <legend className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  {isAr ? "الصلاحية" : "Scope"}
                </legend>
                <label
                  className={clsx(
                    "flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors",
                    scope === "read"
                      ? "border-primary/50 bg-primary/5"
                      : "border-outline/20 hover:bg-surface-container",
                  )}
                >
                  <input
                    type="radio"
                    name="scope"
                    value="read"
                    checked={scope === "read"}
                    onChange={() => setScope("read")}
                    className="mt-1 accent-primary"
                  />
                  <div>
                    <div className="text-sm font-semibold text-on-surface">
                      {isAr ? "قراءة فقط" : "Read-only"}
                    </div>
                    <div className="text-xs text-on-surface-variant">
                      {isAr
                        ? "يمكن استرجاع البيانات فقط."
                        : "Can fetch data only."}
                    </div>
                  </div>
                </label>
                <label
                  className={clsx(
                    "flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors",
                    scope === "write"
                      ? "border-primary/50 bg-primary/5"
                      : "border-outline/20 hover:bg-surface-container",
                  )}
                >
                  <input
                    type="radio"
                    name="scope"
                    value="write"
                    checked={scope === "write"}
                    onChange={() => setScope("write")}
                    className="mt-1 accent-primary"
                  />
                  <div>
                    <div className="text-sm font-semibold text-on-surface">
                      {isAr ? "قراءة وكتابة" : "Read + write"}
                    </div>
                    <div className="text-xs text-on-surface-variant">
                      {isAr
                        ? "يمكن استرجاع البيانات وتعديلها."
                        : "Can fetch and modify data."}
                    </div>
                  </div>
                </label>
              </fieldset>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="rounded-2xl bg-surface-container-highest px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-variant"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="brand-gradient inline-flex items-center gap-2 rounded-2xl px-5 py-2 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isAr ? "إنشاء" : "Create"}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="flex items-start gap-2 rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-950/30 dark:text-red-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {isAr
                    ? "انسخ هذا المفتاح الآن. لن يظهر مجدداً."
                    : "Copy this key now. It won't be shown again."}
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-surface-container-high p-3">
                <code className="min-w-0 flex-1 break-all font-mono text-xs text-on-surface">
                  {secret}
                </code>
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:brightness-105"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      {isAr ? "تم النسخ" : "Copied"}
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      {isAr ? "نسخ" : "Copy"}
                    </>
                  )}
                </button>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="rounded-2xl bg-surface-container-highest px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-variant"
                >
                  {isAr ? "تم" : "Done"}
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
