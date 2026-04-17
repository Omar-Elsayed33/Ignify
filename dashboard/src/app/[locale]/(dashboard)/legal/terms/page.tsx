"use client";

import DashboardHeader from "@/components/DashboardHeader";
import { useLocale } from "next-intl";

export default function TermsPage() {
  const isAr = useLocale() === "ar";

  return (
    <div>
      <DashboardHeader title={isAr ? "شروط الاستخدام" : "Terms of Service"} />

      <div className="px-8 pb-12 pt-2">
        <div className="mx-auto max-w-3xl space-y-6 rounded-3xl bg-surface-container-lowest p-8 shadow-soft">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant/70">
            {isAr ? "آخر تحديث: 17 أبريل 2026" : "Last updated: April 17, 2026"}
          </p>

          {isAr ? (
            <div className="space-y-5 text-sm leading-relaxed text-on-surface">
              <section>
                <h2 className="mb-2 text-lg font-bold">قبولك للشروط</h2>
                <p>باستخدامك لمنصة Ignify، فإنك توافق على هذه الشروط. إذا كنت غير موافق، يرجى عدم استخدام المنصة.</p>
              </section>
              <section>
                <h2 className="mb-2 text-lg font-bold">الاستخدام المسموح به</h2>
                <p>Ignify مخصصة للاستخدام التسويقي القانوني فقط. ممنوع إنشاء محتوى مسيء، كاذب، أو مخالف للقانون. ممنوع استخدام المنصة للبريد العشوائي أو الاحتيال.</p>
              </section>
              <section>
                <h2 className="mb-2 text-lg font-bold">المحتوى المُنشأ بالذكاء الاصطناعي</h2>
                <p>المحتوى المُولَّد بواسطة نماذج الذكاء الاصطناعي ملك لك، لكننا لا نضمن دقته أو أصالته التامة. أنت مسؤول عن مراجعة المحتوى قبل النشر.</p>
              </section>
              <section>
                <h2 className="mb-2 text-lg font-bold">الاشتراك والإلغاء</h2>
                <p>الاشتراكات الشهرية تتجدد تلقائياً. يمكنك الإلغاء في أي وقت من صفحة الفوترة. الرسوم غير قابلة للاسترداد إلا إذا نصّ القانون المحلي على خلاف ذلك.</p>
              </section>
              <section>
                <h2 className="mb-2 text-lg font-bold">الملكية الفكرية</h2>
                <p>جميع حقوق المنصة والتصميم والعلامة التجارية ملك لشركة Ignify. تحتفظ بحقوق المحتوى الذي أنشأته باستخدام المنصة.</p>
              </section>
              <section>
                <h2 className="mb-2 text-lg font-bold">حدود المسؤولية</h2>
                <p>المنصة متاحة "كما هي". لا نتحمل مسؤولية خسائر غير مباشرة ناتجة عن استخدام المنصة أو المحتوى المُنشأ.</p>
              </section>
              <p className="rounded-2xl bg-amber-50 p-4 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                مسودة أولية — في انتظار المراجعة القانونية قبل الإطلاق الرسمي.
              </p>
            </div>
          ) : (
            <div className="space-y-5 text-sm leading-relaxed text-on-surface">
              <section>
                <h2 className="mb-2 text-lg font-bold">Acceptance</h2>
                <p>By using Ignify, you agree to these terms. If you do not agree, please do not use the platform.</p>
              </section>
              <section>
                <h2 className="mb-2 text-lg font-bold">Acceptable use</h2>
                <p>Ignify is for lawful marketing use only. Do not generate offensive, false, or unlawful content. Do not use the platform for spam or fraud.</p>
              </section>
              <section>
                <h2 className="mb-2 text-lg font-bold">AI-generated content</h2>
                <p>AI-generated content is yours, but we make no warranty of accuracy or originality. You are responsible for reviewing content before publishing.</p>
              </section>
              <section>
                <h2 className="mb-2 text-lg font-bold">Subscription and cancellation</h2>
                <p>Monthly subscriptions auto-renew. You can cancel anytime from the Billing page. Fees are non-refundable unless local law requires otherwise.</p>
              </section>
              <section>
                <h2 className="mb-2 text-lg font-bold">Intellectual property</h2>
                <p>All platform, design, and brand rights belong to Ignify. You retain rights to content you create using the platform.</p>
              </section>
              <section>
                <h2 className="mb-2 text-lg font-bold">Limitation of liability</h2>
                <p>The platform is provided "as is". We are not liable for indirect losses arising from use of the platform or generated content.</p>
              </section>
              <p className="rounded-2xl bg-amber-50 p-4 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                First draft — pending legal review before public launch.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
