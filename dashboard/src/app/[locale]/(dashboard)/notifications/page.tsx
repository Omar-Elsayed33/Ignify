"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import { Bell, CheckCheck, FileText, Target, Users, BarChart3, Info } from "lucide-react";
import { clsx } from "clsx";

interface Notification {
  id: string;
  type: "plan" | "campaign" | "lead" | "report" | "info";
  title: string;
  body: string;
  time: string;
  read: boolean;
}

const TYPE_META = {
  plan: { icon: FileText, color: "text-primary", bg: "bg-primary-fixed" },
  campaign: { icon: Target, color: "text-secondary", bg: "bg-secondary-fixed" },
  lead: { icon: Users, color: "text-on-tertiary-fixed-variant", bg: "bg-tertiary-fixed" },
  report: { icon: BarChart3, color: "text-primary", bg: "bg-primary-fixed" },
  info: { icon: Info, color: "text-on-surface-variant", bg: "bg-surface-container-high" },
};

const MOCK: Notification[] = [
  {
    id: "1",
    type: "plan",
    title: "خطتك التسويقية جاهزة",
    body: "تم إنشاء خطة التسويق لشهر أبريل بنجاح. انقر للاطلاع عليها.",
    time: "منذ 5 دقائق",
    read: false,
  },
  {
    id: "2",
    type: "lead",
    title: "عميل محتمل جديد",
    body: "تمت إضافة عميل محتمل جديد من الحملة الإعلانية على إنستجرام.",
    time: "منذ ساعة",
    read: false,
  },
  {
    id: "3",
    type: "campaign",
    title: "حملة مكتملة",
    body: "انتهت حملة 'عروض رمضان' — شاهد التقرير النهائي.",
    time: "أمس",
    read: true,
  },
  {
    id: "4",
    type: "report",
    title: "تقرير الأداء الأسبوعي",
    body: "تقرير الأداء لهذا الأسبوع متاح الآن. معدل التحويل ارتفع 12%.",
    time: "منذ يومين",
    read: true,
  },
];

export default function NotificationsPage() {
  const t = useTranslations("sidebar");
  const [notifications, setNotifications] = useState<Notification[]>(MOCK);

  const unreadCount = notifications.filter((n) => !n.read).length;

  function markAllRead() {
    setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));
  }

  function markRead(id: string) {
    setNotifications((ns) =>
      ns.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  return (
    <div>
      <DashboardHeader title={t("notifications")} />

      <div className="p-8">
        <div className="mx-auto max-w-2xl space-y-6">

          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="brand-gradient flex h-10 w-10 items-center justify-center rounded-xl shadow-soft">
                <Bell className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-headline text-xl font-bold text-on-surface">
                  {t("notifications")}
                </h2>
                {unreadCount > 0 && (
                  <p className="text-sm text-on-surface-variant">
                    {unreadCount} غير مقروءة
                  </p>
                )}
              </div>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-2 rounded-xl bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface transition-all hover:bg-surface-container"
              >
                <CheckCheck className="h-4 w-4" />
                تحديد الكل كمقروء
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="space-y-3">
            {notifications.length === 0 ? (
              <div className="rounded-2xl bg-surface-container-lowest p-12 text-center shadow-soft">
                <Bell className="mx-auto mb-3 h-10 w-10 text-on-surface-variant/30" />
                <p className="text-sm text-on-surface-variant">لا توجد إشعارات</p>
              </div>
            ) : (
              notifications.map((n) => {
                const meta = TYPE_META[n.type];
                const Icon = meta.icon;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => markRead(n.id)}
                    className={clsx(
                      "flex w-full items-start gap-4 rounded-2xl p-4 text-start shadow-soft transition-all hover:-translate-y-0.5",
                      n.read
                        ? "bg-surface-container-lowest"
                        : "bg-surface-container-lowest ring-2 ring-primary/20"
                    )}
                  >
                    <div className={clsx("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", meta.bg)}>
                      <Icon className={clsx("h-5 w-5", meta.color)} />
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className={clsx("text-sm font-semibold text-on-surface", !n.read && "font-bold")}>
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="text-sm text-on-surface-variant">{n.body}</p>
                      <p className="text-xs text-on-surface-variant/60">{n.time}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
