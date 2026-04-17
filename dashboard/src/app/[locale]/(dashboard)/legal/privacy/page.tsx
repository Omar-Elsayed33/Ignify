"use client";

import DashboardHeader from "@/components/DashboardHeader";
import { useLocale } from "next-intl";

export default function PrivacyPage() {
  const isAr = useLocale() === "ar";

  return (
    <div>
      <DashboardHeader title={isAr ? "سياسة الخصوصية" : "Privacy Policy"} />

      <div className="px-8 pb-12 pt-2">
        <div className="mx-auto max-w-3xl space-y-6 rounded-3xl bg-surface-container-lowest p-8 shadow-soft">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant/70">
            {isAr ? "آخر تحديث: 17 أبريل 2026" : "Last updated: April 17, 2026"}
          </p>

          {isAr ? (
            <div className="space-y-5 text-sm leading-relaxed text-on-surface">
              <section>
                <h2 className="mb-2 text-lg font-bold">المعلومات التي نجمعها</h2>
                <p>نجمع المعلومات التي تقدمها عند التسجيل (الاسم، البريد الإلكتروني، تفاصيل النشاط التجاري) والبيانات الناتجة عن استخدامك للمنصة (الخطط، المحتوى، الإحصائيات).</p>
              </section>
              <section>
                <h2 className="mb-2 text-lg font-bold">كيف نستخدم بياناتك</h2>
                <p>نستخدم بياناتك فقط لتشغيل الخدمة، توليد الخطط والمحتوى بالذكاء الاصطناعي، ومعالجة المدفوعات. لا نبيع بياناتك لأطراف ثالثة.</p>
              </section>
              <section>
                <h2 className="mb-2 text-lg font-bold">تصدير وحذف البيانات</h2>
                <p>يمكنك تصدير جميع بياناتك بصيغة JSON أو حذف حسابك في أي وقت من صفحة <a className="text-primary underline" href="/settings/security">الأمان والخصوصية</a>. بعد الحذف، تُحتفظ البيانات لمدة 7 أيام كفترة سماح، ثم تُحذف نهائياً.</p>
              </section>
              <section>
                <h2 className="mb-2 text-lg font-bold">تشفير التوكنز</h2>
                <p>توكنات OAuth لحسابات التواصل الاجتماعي مشفّرة في قاعدة البيانات باستخدام AES-128 (Fernet) مع مفتاح مشتق من SECRET_KEY عبر SHA-256.</p>
              </section>
              <section>
                <h2 className="mb-2 text-lg font-bold">ملفات تعريف الارتباط</h2>
                <p>نستخدم ملفات تعريف الارتباط الأساسية فقط (تسجيل الدخول، تفضيلات الواجهة). لا نستخدم أدوات تتبع إعلانية.</p>
              </section>
              <section>
                <h2 className="mb-2 text-lg font-bold">الاتصال بنا</h2>
                <p>للأسئلة المتعلقة بالخصوصية: <a className="text-primary underline" href="mailto:privacy@ignify.ai">privacy@ignify.ai</a></p>
              </section>
              <p className="rounded-2xl bg-amber-50 p-4 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                مسودة أولية — في انتظار المراجعة القانونية قبل الإطلاق الرسمي.
              </p>
            </div>
          ) : (
            <div className="space-y-5 text-sm leading-relaxed text-on-surface">
              <section>
                <h2 className="mb-2 text-lg font-bold">Information we collect</h2>
                <p>We collect what you provide at sign-up (name, email, business details) plus usage-derived data (plans, content, analytics).</p>
              </section>
              <section>
                <h2 className="mb-2 text-lg font-bold">How we use your data</h2>
                <p>We use your data only to operate the service, generate AI plans and content, and process payments. We do not sell data to third parties.</p>
              </section>
              <section>
                <h2 className="mb-2 text-lg font-bold">Data export and deletion</h2>
                <p>You can export all your data as JSON or delete your account at any time from the <a className="text-primary underline" href="/settings/security">Security &amp; Privacy</a> page. After deletion, data is retained for 7 days as a grace period, then permanently removed.</p>
              </section>
              <section>
                <h2 className="mb-2 text-lg font-bold">Token encryption</h2>
                <p>OAuth tokens for connected social accounts are encrypted at rest using AES-128 (Fernet) with a key derived from SECRET_KEY via SHA-256.</p>
              </section>
              <section>
                <h2 className="mb-2 text-lg font-bold">Cookies</h2>
                <p>We use only essential cookies (login session, UI preferences). We do not use advertising trackers.</p>
              </section>
              <section>
                <h2 className="mb-2 text-lg font-bold">Contact</h2>
                <p>For privacy questions: <a className="text-primary underline" href="mailto:privacy@ignify.ai">privacy@ignify.ai</a></p>
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
