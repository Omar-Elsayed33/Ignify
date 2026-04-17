"use client";

import { useEffect, useState, use } from "react";
import { useLocale } from "next-intl";
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Clock,
  Eye,
  FileText,
  Radio,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { BASE_URL } from "@/lib/api";

interface Persona {
  name?: string;
  age?: string;
  age_range?: string;
  role?: string;
  description?: string;
  [key: string]: unknown;
}

interface CalendarEntry {
  day?: number | string;
  date?: string;
  channel?: string;
  format?: string;
  topic?: string;
  [key: string]: unknown;
}

interface PublicPlan {
  id: string;
  title: string;
  period_days?: number;
  language?: string;
  status?: string;
  created_at?: string;
  goals?: unknown;
  personas?: Persona[] | unknown;
  channels?: unknown;
  calendar?: CalendarEntry[] | unknown;
  kpis?: unknown;
  offer?: unknown;
  positioning?: unknown;
  market_analysis?: unknown;
  [key: string]: unknown;
}

type FetchState =
  | { kind: "loading" }
  | { kind: "ok"; plan: PublicPlan }
  | { kind: "not_found" }
  | { kind: "expired" }
  | { kind: "error"; message: string };

function ReadableBlock({
  data,
  lang,
}: {
  data: unknown;
  lang: "ar" | "en";
}) {
  const dir = lang === "ar" ? "rtl" : "ltr";
  if (data === null || data === undefined) return null;
  if (typeof data === "string") {
    return (
      <p
        className="whitespace-pre-wrap text-sm leading-relaxed text-on-surface-variant"
        dir={dir}
      >
        {data}
      </p>
    );
  }
  if (typeof data === "number" || typeof data === "boolean") {
    return (
      <span className="text-sm text-on-surface-variant" dir={dir}>
        {String(data)}
      </span>
    );
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    if (data.every((x) => typeof x === "string" || typeof x === "number")) {
      return (
        <ul
          className="list-disc space-y-2 ps-5 text-sm leading-relaxed text-on-surface-variant"
          dir={dir}
        >
          {data.map((item, i) => (
            <li key={i} dir={dir}>
              {String(item)}
            </li>
          ))}
        </ul>
      );
    }
    return (
      <div className="space-y-2" dir={dir}>
        {data.map((item, i) => (
          <div
            key={i}
            className="rounded-xl bg-surface-container-low p-3"
            dir={dir}
          >
            <ReadableBlock data={item} lang={lang} />
          </div>
        ))}
      </div>
    );
  }
  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>).filter(
      ([, v]) =>
        v !== null &&
        v !== undefined &&
        !(Array.isArray(v) && v.length === 0) &&
        !(typeof v === "string" && v.trim() === "")
    );
    if (entries.length === 0) return null;
    return (
      <dl className="space-y-2" dir={dir}>
        {entries.map(([k, v]) => (
          <div key={k} className="text-sm" dir={dir}>
            <dt
              className="mb-1 font-headline text-[11px] font-bold uppercase tracking-widest text-on-surface-variant"
              dir={dir}
            >
              {k.replace(/_/g, " ")}
            </dt>
            <dd className="ps-2" dir={dir}>
              <ReadableBlock data={v} lang={lang} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return null;
}

function SectionCard({
  icon: Icon,
  title,
  children,
  lang,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  lang: "ar" | "en";
}) {
  const dir = lang === "ar" ? "rtl" : undefined;
  return (
    <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-soft ring-1 ring-outline/10">
      <div
        className="mb-4 flex items-center gap-3 border-b border-outline/10 pb-3"
        dir={dir}
      >
        <div className="brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-soft">
          <Icon className="h-[18px] w-[18px] text-white" />
        </div>
        <h3
          className="flex-1 font-headline text-base font-bold tracking-tight text-on-surface"
          dir={dir}
          style={{ textAlign: lang === "ar" ? "right" : undefined }}
        >
          {title}
        </h3>
      </div>
      <div dir={dir}>{children}</div>
    </div>
  );
}

export default function PublicPlanPage({
  params,
}: {
  params: Promise<{ token: string; locale: string }>;
}) {
  const { token } = use(params);
  const locale = useLocale();
  const lang: "ar" | "en" = locale === "ar" ? "ar" : "en";
  const dir = lang === "ar" ? "rtl" : "ltr";
  const [state, setState] = useState<FetchState>({ kind: "loading" });

  useEffect(() => {
    (async () => {
      try {
        setState({ kind: "loading" });
        const res = await fetch(`${BASE_URL}/api/v1/plans/public/${token}`, {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        if (res.status === 404) {
          // Read body to distinguish expired (410) vs not_found; treat 404 as not_found.
          setState({ kind: "not_found" });
          return;
        }
        if (res.status === 410) {
          setState({ kind: "expired" });
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const detail =
            typeof body?.detail === "string"
              ? body.detail
              : `HTTP ${res.status}`;
          if (detail === "not_found") {
            setState({ kind: "not_found" });
            return;
          }
          if (detail === "expired") {
            setState({ kind: "expired" });
            return;
          }
          setState({ kind: "error", message: detail });
          return;
        }
        const data = (await res.json()) as PublicPlan;
        setState({ kind: "ok", plan: data });
      } catch (err) {
        setState({
          kind: "error",
          message:
            err instanceof Error
              ? err.message
              : lang === "ar"
              ? "تعذّر تحميل الخطة"
              : "Failed to load plan",
        });
      }
    })();
  }, [token, lang]);

  if (state.kind === "loading") {
    return (
      <div className="min-h-screen bg-surface">
        <div className="brand-gradient h-32 w-full" />
        <div className="mx-auto max-w-4xl p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-1/2 rounded-xl bg-surface-container-highest/60" />
            <div className="h-4 w-1/3 rounded bg-surface-container-highest/60" />
            <div className="mt-8 space-y-3">
              <div className="h-32 w-full rounded-2xl bg-surface-container-highest/60" />
              <div className="h-32 w-full rounded-2xl bg-surface-container-highest/60" />
              <div className="h-32 w-full rounded-2xl bg-surface-container-highest/60" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === "not_found" || state.kind === "expired") {
    const isExpired = state.kind === "expired";
    return (
      <div className="flex min-h-screen flex-col bg-surface" dir={dir}>
        <div className="brand-gradient h-28 w-full" />
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-md rounded-3xl bg-surface-container-lowest p-8 text-center shadow-soft ring-1 ring-outline/10">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-error-container">
              {isExpired ? (
                <Clock className="h-6 w-6 text-on-error-container" />
              ) : (
                <AlertCircle className="h-6 w-6 text-on-error-container" />
              )}
            </div>
            <h1 className="font-headline text-xl font-bold text-on-surface">
              {isExpired
                ? lang === "ar"
                  ? "انتهت صلاحية الرابط"
                  : "Link expired"
                : lang === "ar"
                ? "الرابط غير موجود"
                : "Link not found"}
            </h1>
            <p className="mt-2 text-sm text-on-surface-variant">
              {isExpired
                ? lang === "ar"
                  ? "هذا الرابط لم يعد صالحاً. اطلب من صاحب الخطة إنشاء رابط جديد."
                  : "This link is no longer valid. Ask the plan owner to generate a new one."
                : lang === "ar"
                ? "الرابط غير صحيح أو تم إلغاؤه."
                : "The link is invalid or has been revoked."}
            </p>
            <a
              href={`/${locale}`}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-surface-container-highest px-5 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-variant"
            >
              {lang === "ar" ? "الانتقال إلى Ignify" : "Go to Ignify"}
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="flex min-h-screen flex-col bg-surface" dir={dir}>
        <div className="brand-gradient h-28 w-full" />
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-md rounded-3xl bg-surface-container-lowest p-8 text-center shadow-soft ring-1 ring-outline/10">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-on-error-container" />
            <h1 className="font-headline text-lg font-bold text-on-surface">
              {lang === "ar" ? "حدث خطأ" : "Something went wrong"}
            </h1>
            <p className="mt-2 text-sm text-on-surface-variant">
              {state.message}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const plan = state.plan;
  const personas = Array.isArray(plan.personas)
    ? (plan.personas as Persona[])
    : [];
  const calendar = Array.isArray(plan.calendar)
    ? (plan.calendar as CalendarEntry[])
    : [];
  const calendarPreview = calendar.slice(0, 10);

  return (
    <div className="min-h-screen bg-surface" dir={dir}>
      {/* Branded gradient header */}
      <div className="brand-gradient relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -start-12 -top-12 h-48 w-48 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -end-12 top-4 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-5xl px-6 py-10 text-white">
          <div
            className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest backdrop-blur"
            dir={dir}
          >
            <Eye className="h-3.5 w-3.5" />
            {lang === "ar" ? "عرض للقراءة فقط" : "Read-only view"}
          </div>
          <h1
            className="font-headline text-3xl font-bold tracking-tight sm:text-4xl"
            dir={dir}
          >
            {plan.title}
          </h1>
          <div
            className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/85"
            dir={dir}
          >
            {typeof plan.period_days === "number" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 backdrop-blur">
                <CalendarIcon className="h-3.5 w-3.5" />
                {plan.period_days} {lang === "ar" ? "يوم" : "days"}
              </span>
            )}
            {plan.created_at && (
              <span className="text-xs text-white/80">
                {new Date(plan.created_at).toLocaleDateString(
                  lang === "ar" ? "ar" : "en"
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-5xl space-y-5 p-6 sm:p-10">
        {Boolean(plan.goals) && (
          <SectionCard
            icon={Target}
            title={lang === "ar" ? "الأهداف" : "Goals"}
            lang={lang}
          >
            <ReadableBlock data={plan.goals} lang={lang} />
          </SectionCard>
        )}

        {Boolean(plan.positioning) && (
          <SectionCard
            icon={Sparkles}
            title={lang === "ar" ? "التموضع" : "Positioning"}
            lang={lang}
          >
            <ReadableBlock data={plan.positioning} lang={lang} />
          </SectionCard>
        )}

        {personas.length > 0 && (
          <SectionCard
            icon={Users}
            title={lang === "ar" ? "الجمهور المستهدف" : "Personas"}
            lang={lang}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {personas.map((p, i) => (
                <div
                  key={i}
                  className="rounded-xl bg-surface-container-low p-4"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <div className="brand-gradient flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white">
                      {(p.name ?? `P${i + 1}`).toString().charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-headline text-sm font-bold text-on-surface">
                        {p.name ?? `Persona ${i + 1}`}
                      </h4>
                      {(p.age || p.age_range || p.role) && (
                        <p className="text-[11px] text-on-surface-variant">
                          {p.age ?? p.age_range ?? p.role}
                        </p>
                      )}
                    </div>
                  </div>
                  <ReadableBlock data={p} lang={lang} />
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {Boolean(plan.channels) && (
          <SectionCard
            icon={Radio}
            title={lang === "ar" ? "القنوات" : "Channels"}
            lang={lang}
          >
            <ReadableBlock data={plan.channels} lang={lang} />
          </SectionCard>
        )}

        {Boolean(plan.offer) && (
          <SectionCard
            icon={FileText}
            title={lang === "ar" ? "العرض" : "Offer"}
            lang={lang}
          >
            <ReadableBlock data={plan.offer} lang={lang} />
          </SectionCard>
        )}

        {Boolean(plan.kpis) && (
          <SectionCard
            icon={TrendingUp}
            title={lang === "ar" ? "المؤشرات" : "KPIs"}
            lang={lang}
          >
            <ReadableBlock data={plan.kpis} lang={lang} />
          </SectionCard>
        )}

        {calendarPreview.length > 0 && (
          <SectionCard
            icon={CalendarIcon}
            title={lang === "ar" ? "التقويم (عيّنة)" : "Calendar (preview)"}
            lang={lang}
          >
            <div className="overflow-hidden rounded-xl ring-1 ring-outline/10">
              <table className="w-full text-sm" dir={dir}>
                <thead className="bg-surface-container-low">
                  <tr>
                    <th className="px-4 py-3 text-start font-headline text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                      {lang === "ar" ? "اليوم" : "Day"}
                    </th>
                    <th className="px-4 py-3 text-start font-headline text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                      {lang === "ar" ? "القناة" : "Channel"}
                    </th>
                    <th className="px-4 py-3 text-start font-headline text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                      {lang === "ar" ? "النوع" : "Format"}
                    </th>
                    <th className="px-4 py-3 text-start font-headline text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                      {lang === "ar" ? "الموضوع" : "Topic"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {calendarPreview.map((entry, i) => (
                    <tr
                      key={i}
                      className={
                        i % 2 === 0
                          ? "bg-surface-container-lowest"
                          : "bg-surface-container-low/40"
                      }
                    >
                      <td className="px-4 py-2 font-headline font-bold text-on-surface">
                        {entry.day ?? entry.date ?? i + 1}
                      </td>
                      <td className="px-4 py-2 text-on-surface-variant">
                        {entry.channel ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-on-surface-variant">
                        {entry.format ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-on-surface-variant">
                        {entry.topic ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {calendar.length > calendarPreview.length && (
                <div className="bg-surface-container-low px-4 py-2 text-center text-[11px] text-on-surface-variant">
                  {lang === "ar"
                    ? `+ ${calendar.length - calendarPreview.length} بنود إضافية`
                    : `+ ${calendar.length - calendarPreview.length} more entries`}
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {Boolean(plan.market_analysis) && (
          <SectionCard
            icon={TrendingUp}
            title={lang === "ar" ? "تحليل السوق" : "Market analysis"}
            lang={lang}
          >
            <ReadableBlock data={plan.market_analysis} lang={lang} />
          </SectionCard>
        )}
      </div>

      {/* Footer */}
      <footer className="mx-auto mt-10 max-w-5xl px-6 py-8 text-center">
        <a
          href={`/${locale}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant transition-colors hover:text-primary"
        >
          <span className="text-on-surface-variant/70">
            {lang === "ar" ? "مُقدَّم من" : "Powered by"}
          </span>
          <span className="brand-gradient bg-clip-text font-headline font-bold text-transparent">
            Ignify
          </span>
        </a>
      </footer>
    </div>
  );
}
