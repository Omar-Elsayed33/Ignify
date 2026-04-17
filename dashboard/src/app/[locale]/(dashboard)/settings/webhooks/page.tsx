"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  Plus,
  ShieldOff,
  Trash2,
  Webhook as WebhookIcon,
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

interface WebhookRecord {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  last_delivery_at: string | null;
  last_status_code: number | null;
  created_at: string;
}

interface CreateWebhookResponse {
  secret: string;
  record: WebhookRecord;
}

function relTime(iso: string | null, isAr: boolean): string {
  if (!iso) return "—";
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

function statusTone(code: number | null): "green" | "amber" | "red" | "neutral" {
  if (code == null) return "neutral";
  if (code >= 200 && code < 300) return "green";
  if (code === 0 || (code >= 300 && code < 400)) return "amber";
  if (code >= 400) return "red";
  return "neutral";
}

export default function WebhooksPage() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuthStore();
  const role = user?.role;
  const canManage = role === "owner" || role === "admin";

  const [hooks, setHooks] = useState<WebhookRecord[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canManage) {
      setHooks([]);
      return;
    }
    try {
      const rows = await api.get<WebhookRecord[]>(
        "/api/v1/webhook-subscriptions",
      );
      setHooks(rows);
    } catch (e) {
      setHooks([]);
      toast.error(
        isAr ? "فشل تحميل الـ webhooks" : "Failed to load webhooks",
        e instanceof ApiError ? e.message : undefined,
      );
    }
  }, [canManage, isAr, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (h: WebhookRecord) => {
    const ok = await confirm({
      title: isAr ? "حذف الـ webhook" : "Delete webhook",
      description: isAr
        ? "لن يتم إرسال أي أحداث بعد الحذف ولا يمكن التراجع."
        : "No events will be sent after deletion. This can't be undone.",
      kind: "danger",
      confirmLabel: isAr ? "حذف" : "Delete",
      cancelLabel: isAr ? "إلغاء" : "Cancel",
    });
    if (!ok) return;
    setDeletingId(h.id);
    try {
      await api.delete(`/api/v1/webhook-subscriptions/${h.id}`);
      toast.success(isAr ? "تم الحذف" : "Deleted");
      await load();
    } catch (e) {
      toast.error(
        isAr ? "فشل الحذف" : "Delete failed",
        e instanceof ApiError ? e.message : undefined,
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (!canManage) {
    return (
      <div>
        <DashboardHeader title="Webhooks" />
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
                    ? "فقط مالك المؤسسة أو المدير يمكنهم إدارة الـ webhooks."
                    : "Only owner or admin users can manage webhooks."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasHooks = (hooks?.length ?? 0) > 0;

  return (
    <div>
      <DashboardHeader title="Webhooks" />
      <div className="p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-headline text-2xl font-bold text-on-surface">
                Webhooks
                {isAr && (
                  <span className="ms-2 text-base font-normal text-on-surface-variant">
                    · خطافات الويب
                  </span>
                )}
              </h1>
              <p className="mt-1 max-w-xl text-sm text-on-surface-variant">
                {isAr
                  ? "احصل على إشعارات POST عند حدوث أحداث مهمة."
                  : "Get notified via POST when important events happen."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="brand-gradient inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-transform hover:scale-[1.02]"
            >
              <Plus className="h-4 w-4" />
              {isAr ? "إضافة webhook" : "Add webhook"}
            </button>
          </div>

          <div className="rounded-3xl bg-surface-container-lowest p-1 shadow-soft">
            {hooks === null ? (
              <div className="space-y-2 p-5">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : !hasHooks ? (
              <div className="p-4">
                <EmptyState
                  icon={WebhookIcon}
                  title={isAr ? "لا توجد webhooks بعد" : "No webhooks yet"}
                  description={
                    isAr
                      ? "أضف أول webhook لتتلقى إشعارات الأحداث."
                      : "Add your first webhook to receive event notifications."
                  }
                  actionLabel={isAr ? "إضافة webhook" : "Add webhook"}
                  onAction={() => setCreating(true)}
                />
              </div>
            ) : (
              <div className="divide-y divide-outline/10">
                {hooks.map((h) => (
                  <div
                    key={h.id}
                    className="flex flex-wrap items-start gap-4 p-5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <code
                          className="truncate rounded-lg bg-surface-container-high px-2 py-0.5 font-mono text-xs text-on-surface"
                          title={h.url}
                        >
                          {h.url}
                        </code>
                        <StatusChip
                          tone={statusTone(h.last_status_code)}
                          code={h.last_status_code}
                          isAr={isAr}
                        />
                        <ActiveToggle active={h.is_active} isAr={isAr} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {h.events.map((ev) => (
                          <span
                            key={ev}
                            className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary"
                          >
                            {ev}
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 text-xs text-on-surface-variant">
                        {isAr ? "آخر تسليم: " : "Last delivery: "}
                        {relTime(h.last_delivery_at, isAr)}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={deletingId === h.id}
                      onClick={() => handleDelete(h)}
                      className="inline-flex items-center gap-1 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-60 dark:text-red-400"
                    >
                      {deletingId === h.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      {isAr ? "حذف" : "Delete"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <CreateWebhookDialog
        open={creating}
        onOpenChange={setCreating}
        isAr={isAr}
        onCreated={async () => {
          await load();
        }}
      />
    </div>
  );
}

function StatusChip({
  tone,
  code,
  isAr,
}: {
  tone: "green" | "amber" | "red" | "neutral";
  code: number | null;
  isAr: boolean;
}) {
  const label =
    code == null
      ? isAr
        ? "بانتظار التسليم"
        : "Pending"
      : code === 0
        ? isAr
          ? "فشل الاتصال"
          : "Connection error"
        : `HTTP ${code}`;
  const styles = {
    green: "bg-green-500/10 text-green-700 dark:text-green-400",
    amber: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    red: "bg-red-500/10 text-red-700 dark:text-red-400",
    neutral: "bg-surface-container-highest text-on-surface-variant",
  }[tone];
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        styles,
      )}
    >
      {label}
    </span>
  );
}

function ActiveToggle({ active, isAr }: { active: boolean; isAr: boolean }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        active
          ? "bg-green-500/10 text-green-700 dark:text-green-400"
          : "bg-surface-container-highest text-on-surface-variant",
      )}
      title={
        isAr
          ? "تفعيل/تعطيل الحالة (للعرض فقط)"
          : "Active state (display only)"
      }
    >
      <span
        className={clsx(
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-green-500" : "bg-on-surface-variant",
        )}
      />
      {active ? (isAr ? "نشط" : "Active") : isAr ? "متوقف" : "Inactive"}
    </span>
  );
}

function CreateWebhookDialog({
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
  const [url, setUrl] = useState("");
  const [availableEvents, setAvailableEvents] = useState<string[] | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setUrl("");
      setSelectedEvents([]);
      setSubmitting(false);
      setSecret(null);
      setCopied(false);
      setEventsError(null);
      return;
    }
    let cancelled = false;
    setAvailableEvents(null);
    setEventsError(null);
    (async () => {
      try {
        const res = await api.get<{ events: string[] }>(
          "/api/v1/webhook-subscriptions/events",
        );
        if (!cancelled) setAvailableEvents(res.events ?? []);
      } catch (e) {
        if (!cancelled) {
          setAvailableEvents([]);
          setEventsError(
            e instanceof ApiError
              ? e.message
              : isAr
                ? "فشل تحميل الأحداث"
                : "Failed to load events",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, isAr]);

  const toggleEvent = (ev: string) => {
    setSelectedEvents((prev) =>
      prev.includes(ev) ? prev.filter((x) => x !== ev) : [...prev, ev],
    );
  };

  const canSubmit =
    url.trim().startsWith("https://") && selectedEvents.length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await api.post<CreateWebhookResponse>(
        "/api/v1/webhook-subscriptions",
        {
          url: url.trim(),
          events: selectedEvents,
        },
      );
      setSecret(res.secret);
      await onCreated();
    } catch (e) {
      toast.error(
        isAr ? "فشل الإنشاء" : "Failed to create",
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
        <Dialog.Content className="fixed start-1/2 top-1/2 z-[100] flex max-h-[90vh] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col rounded-3xl bg-surface-container-lowest p-6 shadow-[0_8px_30px_rgba(0,0,0,0.2)] ring-1 ring-outline/10 rtl:translate-x-1/2 data-[state=open]:animate-in data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between gap-2">
            <Dialog.Title className="font-headline text-lg font-bold text-on-surface">
              {secret
                ? isAr
                  ? "سر التوقيع الخاص بك"
                  : "Your signing secret"
                : isAr
                  ? "إضافة webhook"
                  : "Add webhook"}
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
            <form onSubmit={submit} className="mt-4 flex flex-col gap-4 overflow-hidden">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  URL
                </label>
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/hooks/ignify"
                  className="w-full rounded-xl bg-surface-container-low px-4 py-2.5 font-mono text-sm text-on-surface outline-none transition-all focus:ring-2 focus:ring-primary/30"
                />
                {url.length > 0 && !url.trim().startsWith("https://") && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {isAr
                      ? "يجب أن يبدأ الرابط بـ https://"
                      : "URL must start with https://"}
                  </p>
                )}
              </div>

              <div className="flex min-h-0 flex-col">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  {isAr ? "الأحداث" : "Events"}
                </label>
                <div className="max-h-56 overflow-y-auto rounded-2xl bg-surface-container-low p-2">
                  {availableEvents === null ? (
                    <div className="space-y-2 p-1">
                      <Skeleton className="h-6" />
                      <Skeleton className="h-6" />
                      <Skeleton className="h-6" />
                    </div>
                  ) : eventsError ? (
                    <div className="p-3 text-xs text-red-600 dark:text-red-400">
                      {eventsError}
                    </div>
                  ) : availableEvents.length === 0 ? (
                    <div className="p-3 text-xs text-on-surface-variant">
                      {isAr ? "لا توجد أحداث متاحة." : "No events available."}
                    </div>
                  ) : (
                    <ul className="space-y-1">
                      {availableEvents.map((ev) => {
                        const checked = selectedEvents.includes(ev);
                        return (
                          <li key={ev}>
                            <label
                              className={clsx(
                                "flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors",
                                checked
                                  ? "bg-primary/10 text-on-surface"
                                  : "text-on-surface hover:bg-surface-container",
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleEvent(ev)}
                                className="accent-primary"
                              />
                              <span className="font-mono text-xs">{ev}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {isAr
                    ? "اختر حدثاً واحداً على الأقل."
                    : "Pick at least one event."}
                </p>
              </div>

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
                  disabled={submitting || !canSubmit}
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
                    ? "انسخ هذا السر الآن. لن يظهر مجدداً. استخدمه للتحقق من توقيع الطلبات."
                    : "Copy this secret now. It won't be shown again. Use it to verify request signatures."}
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
