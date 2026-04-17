"use client";

import { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import DashboardHeader from "@/components/DashboardHeader";
import PageHeader from "@/components/PageHeader";
import {
  Utensils,
  ShoppingBag,
  Laptop,
  Sparkles,
  Building,
  Dumbbell,
  Briefcase,
  GraduationCap,
  ArrowRight,
  LayoutGrid,
} from "lucide-react";
import { clsx } from "clsx";

interface Template {
  key: string;
  icon: React.ElementType;
  title_ar: string;
  title_en: string;
  description_ar: string;
  description_en: string;
  tags: string[];
  accent: string; // tailwind color classes for icon bg
}

const TEMPLATES: Template[] = [
  {
    key: "restaurant",
    icon: Utensils,
    title_ar: "مطعم محلي",
    title_en: "Local Restaurant",
    description_ar: "خطة تسويقية للمطاعم تركز على العروض اليومية، التصوير الغذائي، والتفاعل المحلي.",
    description_en: "Restaurant plan focused on daily offers, food photography, and local engagement.",
    tags: ["B2C", "Instagram-heavy", "local", "delivery", "reviews"],
    accent: "bg-orange-500/10 text-orange-600",
  },
  {
    key: "ecommerce",
    icon: ShoppingBag,
    title_ar: "متجر إلكتروني",
    title_en: "E-commerce Store",
    description_ar: "حملات أداء مبنية على الكتالوج، إعادة الاستهداف، وقمع تحويل واضح للمتاجر الإلكترونية.",
    description_en: "Catalog-driven performance campaigns, retargeting, and a clear conversion funnel for online stores.",
    tags: ["B2C", "Meta Ads", "retargeting", "email", "ROAS"],
    accent: "bg-pink-500/10 text-pink-600",
  },
  {
    key: "saas",
    icon: Laptop,
    title_ar: "منتج SaaS",
    title_en: "SaaS Product",
    description_ar: "محتوى تعليمي، SEO طويل الأمد، وعروض تجريبية مجانية لجذب الاشتراكات الشهرية.",
    description_en: "Educational content, long-term SEO, and free-trial offers to drive monthly subscriptions.",
    tags: ["B2B", "SEO", "content-led", "LinkedIn", "free-trial"],
    accent: "bg-blue-500/10 text-blue-600",
  },
  {
    key: "beauty",
    icon: Sparkles,
    title_ar: "العناية والجمال",
    title_en: "Beauty & Cosmetics",
    description_ar: "محتوى بصري جذاب، تعاون مع المؤثرين، ومراجعات قبل/بعد لعلامات التجميل.",
    description_en: "Visually rich content, influencer partnerships, and before/after reviews for beauty brands.",
    tags: ["B2C", "TikTok", "influencer", "UGC", "visual"],
    accent: "bg-fuchsia-500/10 text-fuchsia-600",
  },
  {
    key: "real-estate",
    icon: Building,
    title_ar: "عقارات",
    title_en: "Real Estate",
    description_ar: "قوائم مصورة باحترافية، جولات افتراضية، وإعلانات جغرافية لجذب العملاء المحتملين.",
    description_en: "Professionally shot listings, virtual tours, and geo-targeted ads to capture qualified leads.",
    tags: ["B2C", "local", "lead-gen", "video", "long-cycle"],
    accent: "bg-amber-500/10 text-amber-700",
  },
  {
    key: "fitness",
    icon: Dumbbell,
    title_ar: "اللياقة والصحة",
    title_en: "Fitness & Wellness",
    description_ar: "محتوى تحفيزي، تحديات مجتمعية، وبرامج اشتراك شهرية لصالات اللياقة والمدربين.",
    description_en: "Motivational content, community challenges, and monthly membership funnels for gyms and coaches.",
    tags: ["B2C", "Instagram-heavy", "community", "subscription", "video"],
    accent: "bg-emerald-500/10 text-emerald-600",
  },
  {
    key: "agency",
    icon: Briefcase,
    title_ar: "وكالة تسويق",
    title_en: "Marketing Agency",
    description_ar: "قيادة فكرية، دراسات حالة، وعروض محتوى عالية الجودة لجذب عملاء B2B.",
    description_en: "Thought leadership, case studies, and high-quality content offers to win B2B clients.",
    tags: ["B2B", "LinkedIn", "case-studies", "thought-leadership", "referrals"],
    accent: "bg-indigo-500/10 text-indigo-600",
  },
  {
    key: "education",
    icon: GraduationCap,
    title_ar: "تعليم ودورات",
    title_en: "Education & Courses",
    description_ar: "ندوات عبر الإنترنت، محتوى مجاني قيم، وقمع تسجيل طويل لدورات ومعاهد التعليم.",
    description_en: "Webinars, valuable free content, and a long enrollment funnel for courses and academies.",
    tags: ["B2C", "webinars", "email", "long-funnel", "YouTube"],
    accent: "bg-sky-500/10 text-sky-600",
  },
];

export default function TemplatesPage() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const router = useRouter();
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const headerTitle = isAr ? "معرض القوالب" : "Template Gallery";
  const headerDescription = isAr
    ? "ابدأ بسرعة بخطة تسويقية مخصصة لقطاعك. كل قالب يقترح محاور، قنوات، وتكتيكات جاهزة للتخصيص."
    : "Kick off fast with a marketing plan tailored to your industry. Each template suggests themes, channels, and tactics you can customize.";

  const templates = useMemo(() => TEMPLATES, []);

  return (
    <div>
      <DashboardHeader title={headerTitle} />
      <div className="p-8">
        <div className="space-y-8">
          <PageHeader
            eyebrow={isAr ? "قوالب" : "TEMPLATES"}
            title={headerTitle}
            description={headerDescription}
          />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {templates.map((tpl) => {
              const Icon = tpl.icon;
              const title = isAr ? tpl.title_ar : tpl.title_en;
              const description = isAr ? tpl.description_ar : tpl.description_en;
              const isHovered = hoveredKey === tpl.key;
              return (
                <article
                  key={tpl.key}
                  onMouseEnter={() => setHoveredKey(tpl.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  className={clsx(
                    "group flex flex-col rounded-2xl bg-surface-container-lowest p-5 shadow-soft transition-all",
                    "hover:-translate-y-1 hover:shadow-soft-lg"
                  )}
                >
                  <div
                    className={clsx(
                      "mb-4 flex h-12 w-12 items-center justify-center rounded-2xl transition-transform",
                      tpl.accent,
                      isHovered && "scale-110"
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>

                  <h3 className="font-headline text-lg font-bold tracking-tight text-on-surface">
                    {title}
                  </h3>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant/70">
                    {isAr ? tpl.title_en : tpl.title_ar}
                  </p>

                  <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-on-surface-variant">
                    {description}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {tpl.tags.slice(0, 5).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-surface-container-low px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/plans/new?template=${encodeURIComponent(tpl.key)}`)
                    }
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-all hover:brightness-110"
                  >
                    {isAr ? "استخدم القالب" : "Use template"}
                    <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                  </button>
                </article>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-2 rounded-2xl bg-surface-container-low p-5 text-sm text-on-surface-variant">
            <LayoutGrid className="h-4 w-4" />
            <span>
              {isAr
                ? "لا تجد قالباً مناسباً؟ ابدأ خطة مخصصة من الصفر."
                : "Can't find a suitable template? Start a custom plan from scratch."}
            </span>
            <button
              type="button"
              onClick={() => router.push("/plans/new")}
              className="ms-2 font-semibold text-primary hover:underline"
            >
              {isAr ? "خطة جديدة" : "New plan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
