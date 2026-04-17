"use client";

import { useEffect, useMemo, useState, use } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  History,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import Skeleton, { SkeletonText } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/components/Toaster";
import { useConfirm } from "@/components/ConfirmDialog";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

interface VersionRow {
  id: string;
  plan_id: string;
  version: number;
  reason?: string | null;
  created_by?: string | null;
  created_at: string;
  payload_keys?: string[] | null;
}

interface VersionSnapshot extends VersionRow {
  payload?: Record<string, unknown> | null;
}

interface MarketingPlan {
  id: string;
  title: string;
}

function formatRelative(iso: string, lang: "ar" | "en"): string {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - then);
    const sec = Math.floor(diff / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);
    if (lang === "ar") {
      if (sec < 60) return "قبل لحظات";
      if (min < 60) return `قبل ${min} دقيقة`;
      if (hr < 24) return `قبل ${hr} ساعة`;
      if (day < 30) return `قبل ${day} يوم`;
      return new Date(iso).toLocaleDateString("ar");
    }
    if (sec < 60) return "just now";
    if (min < 60) return `${min} min ago`;
    if (hr < 24) return `${hr} h ago`;
    if (day < 30) return `${day} d ago`;
    return new Date(iso).toLocaleDateString("en");
  } catch {
    return iso;
  }
}

export default function PlanVersionsPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = use(params);
  const locale = useLocale();
  const lang: "ar" | "en" = locale === "ar" ? "ar" : "en";
  const dir = lang === "ar" ? "rtl" : "ltr";
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const user = useAuthStore((s) => s.user);
  const canRollback = useMemo(() => {
    const role = (user?.role || "").toLowerCase();
    return role === "owner" || role === "admin" || role === "superadmin";
  }, [user]);

  const [plan, setPlan] = useState<MarketingPlan | null>(null);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [viewSnapshot, setViewSnapshot] = useState<VersionSnapshot | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [p, list] = await Promise.all([
          api.get<MarketingPlan>(`/api/v1/plans/${id}`),
          api.get<VersionRow[]>(`/api/v1/plans/${id}/versions`),
        ]);
        setPlan(p);
        setVersions(list);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : lang === "ar"
            ? "تعذّر تحميل سجل الإصدارات"
            : "Failed to load version history"
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [id, lang]);

  async function handleView(row: VersionRow) {
    try {
      setViewLoading(true);
      setViewSnapshot({ ...row, payload: null });
      const full = await api.get<VersionSnapshot>(
        `/api/v1/plans/${id}/versions/${row.id}`
      );
      setViewSnapshot(full);
    } catch (err) {
      setViewSnapshot(null);
      toast.error(
        err instanceof Error
          ? err.message
          : lang === "ar"
          ? "تعذّر تحميل الإصدار"
          : "Failed to load snapshot"
      );
    } finally {
      setViewLoading(false);
    }
  }

  async function handleRollback(row: VersionRow) {
    const ok = await confirm({
      kind: "danger",
      title:
        lang === "ar"
          ? `إعادة تطبيق الإصدار ${row.version}؟`
          : `Rollback to version ${row.version}?`,
      description:
        lang === "ar"
          ? "سيتم إنشاء إصدار جديد يحمل محتوى هذا الإصدار. لن يُفقد الإصدار الحالي."
          : "A new version will be created with the fields from this snapshot. The current version is preserved.",
      confirmLabel: lang === "ar" ? "إعادة تطبيق" : "Rollback",
      cancelLabel: lang === "ar" ? "إلغاء" : "Cancel",
    });
    if (!ok) return;
    try {
      setRollingBack(row.id);
      await api.post<{ id: string; version: number; status: string }>(
        `/api/v1/plans/${id}/versions/${row.id}/rollback`
      );
      toast.success(
        lang === "ar" ? "تم إعادة تطبيق الإصدار" : "Rolled back successfully"
      );
      router.push(`/plans/${id}`);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : lang === "ar"
          ? "تعذّر إعادة التطبيق"
          : "Rollback failed"
      );
    } finally {
      setRollingBack(null);
    }
  }

  const pageTitle = lang === "ar" ? "سجل الإصدارات" : "Version history";

  return (
    <div>
      <DashboardHeader title={plan?.title ?? pageTitle} />

      <div className="p-8">
        <div className="space-y-8">
          <button
            onClick={() => router.push(`/plans/${id}`)}
            className="flex items-center gap-1.5 text-sm font-semibold text-on-surface-variant transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {plan?.title ?? (lang === "ar" ? "الخطة" : "Plan")}
          </button>

          <div className="space-y-4">
            <div className="brand-gradient h-1 w-24 rounded-full" />
            <PageHeader eyebrow="HISTORY" title={pageTitle} />
            <p
              className="max-w-2xl text-sm text-on-surface-variant"
              dir={dir}
            >
              {lang === "ar"
                ? "تحتفظ كل إعادة توليد أو تعديل رئيسي بلقطة كاملة للخطة. يمكنك مراجعتها أو إعادة تطبيقها في أي وقت."
                : "Every regeneration or major edit keeps a full snapshot of the plan. Review or restore any version at any time."}
            </p>
          </div>

          {error && (
            <Card padding="sm" className="flex items-center gap-3 !bg-error-container">
              <AlertCircle className="h-4 w-4 shrink-0 text-on-error-container" />
              <span className="text-sm font-medium text-on-error-container">
                {error}
              </span>
            </Card>
          )}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} padding="md">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-1/3" />
                      <SkeletonText className="mt-3" lines={1} />
                    </div>
                    <Skeleton className="h-9 w-20 rounded-xl" />
                  </div>
                </Card>
              ))}
            </div>
          ) : versions.length === 0 ? (
            <EmptyState
              icon={History}
              title={lang === "ar" ? "لا توجد إصدارات بعد" : "No versions yet"}
              description={
                lang === "ar"
                  ? "ستظهر هنا لقطات الخطة تلقائياً عند كل إعادة توليد."
                  : "Snapshots appear here automatically after each regeneration."
              }
            />
          ) : (
            <div className="space-y-3">
              {versions.map((v) => {
                const author = v.created_by
                  ? v.created_by.slice(0, 8)
                  : lang === "ar"
                  ? "النظام"
                  : "system";
                const isRolling = rollingBack === v.id;
                return (
                  <Card
                    key={v.id}
                    padding="md"
                    className="transition-shadow hover:shadow-md"
                  >
                    <div
                      className="flex flex-wrap items-center gap-4"
                      dir={dir}
                    >
                      <div className="brand-gradient flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-soft">
                        <span className="font-headline text-sm font-bold text-white">
                          v{v.version}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-headline text-sm font-bold text-on-surface">
                            {v.reason ||
                              (lang === "ar" ? "تحديث" : "Update")}
                          </h3>
                          <Badge tone="neutral">
                            {lang === "ar" ? "بواسطة" : "by"} {author}
                          </Badge>
                          <span className="text-xs text-on-surface-variant">
                            {formatRelative(v.created_at, lang)}
                          </span>
                        </div>
                        {v.payload_keys && v.payload_keys.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {v.payload_keys.slice(0, 6).map((k) => (
                              <span
                                key={k}
                                className="rounded-full bg-surface-container-low px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant"
                              >
                                {k}
                              </span>
                            ))}
                            {v.payload_keys.length > 6 && (
                              <span className="text-[10px] text-on-surface-variant">
                                +{v.payload_keys.length - 6}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleView(v)}
                          leadingIcon={<Eye className="h-3.5 w-3.5" />}
                        >
                          {lang === "ar" ? "عرض" : "View"}
                        </Button>
                        {canRollback && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleRollback(v)}
                            disabled={isRolling}
                            leadingIcon={
                              isRolling ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3.5 w-3.5" />
                              )
                            }
                          >
                            {lang === "ar" ? "إعادة تطبيق" : "Rollback"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Snapshot viewer modal */}
      <Dialog.Root
        open={viewSnapshot !== null}
        onOpenChange={(o) => !o && setViewSnapshot(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed start-1/2 top-1/2 z-[100] max-h-[85vh] w-[92vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl bg-surface-container-lowest shadow-[0_8px_30px_rgba(0,0,0,0.2)] ring-1 ring-outline/10 rtl:translate-x-1/2 data-[state=open]:animate-in data-[state=open]:zoom-in-95">
            <div
              className="flex items-center justify-between border-b border-outline/10 p-5"
              dir={dir}
            >
              <div className="min-w-0">
                <Dialog.Title className="font-headline text-base font-bold text-on-surface">
                  {lang === "ar"
                    ? `الإصدار ${viewSnapshot?.version ?? ""}`
                    : `Version ${viewSnapshot?.version ?? ""}`}
                </Dialog.Title>
                {viewSnapshot?.reason && (
                  <Dialog.Description className="mt-1 text-xs text-on-surface-variant">
                    {viewSnapshot.reason}
                  </Dialog.Description>
                )}
              </div>
              <Dialog.Close asChild>
                <button
                  aria-label={lang === "ar" ? "إغلاق" : "Close"}
                  className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>
            <div className="max-h-[65vh] overflow-y-auto p-5" dir="ltr">
              {viewLoading && !viewSnapshot?.payload ? (
                <div className="space-y-3">
                  <SkeletonText lines={8} />
                </div>
              ) : viewSnapshot?.payload &&
                Object.keys(viewSnapshot.payload).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(viewSnapshot.payload).map(([k, v]) => (
                    <div key={k}>
                      <p className="mb-1 font-headline text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                        {k}
                      </p>
                      <pre className="whitespace-pre-wrap break-words rounded-xl bg-surface-container-low p-3 text-xs leading-relaxed text-on-surface">
                        {JSON.stringify(v, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-on-surface-variant">
                  {lang === "ar"
                    ? "هذه اللقطة فارغة."
                    : "This snapshot is empty."}
                </p>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
