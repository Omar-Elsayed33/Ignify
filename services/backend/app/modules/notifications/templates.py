"""Bilingual (AR+EN) email templates.

Each builder returns (subject, html, text). Callers pass the user's
``lang_preference`` so we prioritise the matching language block, but the
emails are always bilingual so nothing is lost if the preference is wrong.
"""
from __future__ import annotations

from typing import Any

from app.core.config import settings

BRAND = "Ignify"
PRIMARY = "#f97316"


def _wrap(html_body_en: str, html_body_ar: str) -> str:
    return f"""<!DOCTYPE html>
<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background:#fafafa;">
  <div style="text-align:center; padding:20px 0;">
    <h1 style="color:{PRIMARY}; margin:0;">{BRAND}</h1>
  </div>
  <div style="background:#fff; border:1px solid #eee; border-radius:8px; overflow:hidden;">
    <div style="direction:ltr; text-align:left; padding:24px; border-bottom:1px solid #eee;">{html_body_en}</div>
    <div style="direction:rtl; text-align:right; padding:24px;">{html_body_ar}</div>
  </div>
  <p style="font-size:11px; color:#999; text-align:center; margin-top:16px;">
    © {BRAND} · You received this because you signed up at Ignify.
  </p>
</body></html>"""


def build_welcome(name: str, locale: str = "en") -> tuple[str, str, str]:
    subject = f"Welcome to {BRAND} · أهلاً بك في {BRAND}"
    en = f"""
    <h2>Hi {name},</h2>
    <p>Welcome to {BRAND}! We're excited to help you put your marketing on autopilot.</p>
    <p>Three things to try first:</p>
    <ol>
      <li>Generate your first marketing plan (2 minutes).</li>
      <li>Connect your Instagram or WhatsApp account.</li>
      <li>Draft your first AI-generated post.</li>
    </ol>
    <p><a href="{settings.FRONTEND_URL}/{locale}/dashboard" style="background:{PRIMARY}; color:white; padding:12px 24px; text-decoration:none; border-radius:6px; display:inline-block;">Open dashboard</a></p>
    """
    ar = f"""
    <h2>مرحباً {name}،</h2>
    <p>أهلاً بك في {BRAND}! يسعدنا أن نساعدك على أتمتة تسويقك.</p>
    <p>ثلاثة أشياء جرّبها أولاً:</p>
    <ol>
      <li>أنشئ أول خطة تسويقية لك (دقيقتان).</li>
      <li>اربط حساب إنستجرام أو واتساب.</li>
      <li>اكتب أول منشور بالذكاء الاصطناعي.</li>
    </ol>
    <p><a href="{settings.FRONTEND_URL}/{locale}/dashboard" style="background:{PRIMARY}; color:white; padding:12px 24px; text-decoration:none; border-radius:6px; display:inline-block;">فتح لوحة التحكم</a></p>
    """
    text = f"Welcome to {BRAND}, {name}!\nOpen your dashboard: {settings.FRONTEND_URL}/{locale}/dashboard\n\nمرحباً {name}، أهلاً بك في {BRAND}."
    return subject, _wrap(en, ar), text


def build_verify_email(name: str, link: str, locale: str = "en") -> tuple[str, str, str]:
    subject = "Verify your email — تأكيد بريدك الإلكتروني | Ignify"
    en = f"""
    <h2>Hi {name},</h2>
    <p>Please confirm your email to activate your account:</p>
    <p><a href="{link}" style="background:{PRIMARY}; color:white; padding:12px 24px; text-decoration:none; border-radius:6px; display:inline-block;">Verify email</a></p>
    <p style="font-size:12px; color:#666;">This link expires in {settings.EMAIL_VERIFICATION_EXPIRE_HOURS} hours.</p>
    """
    ar = f"""
    <h2>مرحباً {name}،</h2>
    <p>يرجى تأكيد بريدك الإلكتروني لتفعيل حسابك:</p>
    <p><a href="{link}" style="background:{PRIMARY}; color:white; padding:12px 24px; text-decoration:none; border-radius:6px; display:inline-block;">تأكيد البريد</a></p>
    <p style="font-size:12px; color:#666;">ينتهي الرابط خلال {settings.EMAIL_VERIFICATION_EXPIRE_HOURS} ساعة.</p>
    """
    text = f"Verify your email: {link}"
    return subject, _wrap(en, ar), text


def build_onboarding_day_1(name: str, locale: str = "en") -> tuple[str, str, str]:
    subject = "Let's finish setting up your account · لنكمل إعداد حسابك"
    en = f"""
    <h2>Hi {name},</h2>
    <p>Yesterday you joined {BRAND}. Today let's take 5 minutes to finish your setup.</p>
    <p>Next step: complete your brand profile so every AI output sounds like your brand.</p>
    <p><a href="{settings.FRONTEND_URL}/{locale}/onboarding" style="background:{PRIMARY}; color:white; padding:10px 20px; text-decoration:none; border-radius:6px;">Continue onboarding</a></p>
    """
    ar = f"""
    <h2>مرحباً {name}،</h2>
    <p>أمس انضممت إلى {BRAND}. اليوم خذ 5 دقائق لإنهاء إعداد حسابك.</p>
    <p>الخطوة التالية: أكمل ملف علامتك التجارية لتكون كل المخرجات بنبرتك.</p>
    <p><a href="{settings.FRONTEND_URL}/{locale}/onboarding" style="background:{PRIMARY}; color:white; padding:10px 20px; text-decoration:none; border-radius:6px;">إكمال الإعداد</a></p>
    """
    return subject, _wrap(en, ar), "Finish onboarding at Ignify."


def build_onboarding_day_3(name: str, locale: str = "en") -> tuple[str, str, str]:
    subject = "Generate your first marketing plan · أنشئ أول خطة تسويقية"
    en = f"""
    <h2>Hi {name},</h2>
    <p>You haven't generated a marketing plan yet. It takes less than 3 minutes and gives you a full 90-day calendar, personas, KPIs, and a market analysis — all tailored to your brand.</p>
    <p><a href="{settings.FRONTEND_URL}/{locale}/plans" style="background:{PRIMARY}; color:white; padding:10px 20px; text-decoration:none; border-radius:6px;">Create my plan</a></p>
    """
    ar = f"""
    <h2>مرحباً {name}،</h2>
    <p>لم تنشئ بعد خطة تسويقية. تأخذ أقل من 3 دقائق وتعطيك تقويم 90 يوم كامل، وشخصيات العميل، ومؤشرات الأداء، وتحليل السوق — كل ذلك مفصّل لعلامتك.</p>
    <p><a href="{settings.FRONTEND_URL}/{locale}/plans" style="background:{PRIMARY}; color:white; padding:10px 20px; text-decoration:none; border-radius:6px;">إنشاء خطتي</a></p>
    """
    return subject, _wrap(en, ar), "Generate your first plan at Ignify."


def build_onboarding_day_7(name: str, locale: str = "en") -> tuple[str, str, str]:
    subject = "Tips to get more from Ignify · نصائح للاستفادة أكثر"
    en = f"""
    <h2>Hi {name},</h2>
    <p>You've been with {BRAND} for a week. Here are three power-user tips:</p>
    <ul>
      <li><strong>AI Inbox</strong>: reply to customer DMs 10x faster with suggested replies.</li>
      <li><strong>Creative Studio</strong>: generate on-brand product imagery in seconds.</li>
      <li><strong>Scheduler</strong>: queue a month of posts in one sitting.</li>
    </ul>
    """
    ar = f"""
    <h2>مرحباً {name}،</h2>
    <p>مر أسبوع معنا في {BRAND}. ثلاث نصائح احترافية:</p>
    <ul>
      <li><strong>الصندوق الذكي</strong>: رد على رسائل العملاء أسرع بـ 10 مرات.</li>
      <li><strong>استوديو المحتوى</strong>: ولّد صور منتجات بهوية علامتك في ثوانٍ.</li>
      <li><strong>الجدول الزمني</strong>: جهّز منشورات شهر كامل في جلسة واحدة.</li>
    </ul>
    """
    return subject, _wrap(en, ar), "Power-user tips for Ignify."


def build_weekly_report(name: str, stats: dict[str, Any], locale: str = "en") -> tuple[str, str, str]:
    reach = stats.get("reach", 0)
    engagement = stats.get("engagement_rate", 0)
    new_leads = stats.get("new_leads", 0)
    posts = stats.get("posts_published", 0)
    subject = "Your weekly marketing report · تقريرك الأسبوعي"
    en = f"""
    <h2>Hi {name},</h2>
    <p>Here's your weekly snapshot from {BRAND}:</p>
    <ul>
      <li>Reach: <strong>{reach:,}</strong></li>
      <li>Engagement rate: <strong>{engagement}%</strong></li>
      <li>New leads: <strong>{new_leads}</strong></li>
      <li>Posts published: <strong>{posts}</strong></li>
    </ul>
    <p><a href="{settings.FRONTEND_URL}/{locale}/analytics" style="background:{PRIMARY}; color:white; padding:10px 20px; text-decoration:none; border-radius:6px;">Open analytics</a></p>
    """
    ar = f"""
    <h2>مرحباً {name}،</h2>
    <p>لقطتك الأسبوعية من {BRAND}:</p>
    <ul>
      <li>الوصول: <strong>{reach:,}</strong></li>
      <li>معدل التفاعل: <strong>{engagement}%</strong></li>
      <li>عملاء محتملون جدد: <strong>{new_leads}</strong></li>
      <li>منشورات تم نشرها: <strong>{posts}</strong></li>
    </ul>
    """
    return subject, _wrap(en, ar), f"Weekly report: reach={reach}, engagement={engagement}%, new leads={new_leads}."


def build_plan_expiring_soon(name: str, plan_title: str, days_left: int, locale: str = "en") -> tuple[str, str, str]:
    subject = "Your marketing plan is ending soon · خطتك التسويقية على وشك الانتهاء"
    en = f"""
    <h2>Hi {name},</h2>
    <p>Your plan <strong>{plan_title}</strong> ends in {days_left} days. Want to roll it forward with fresh AI recommendations?</p>
    <p><a href="{settings.FRONTEND_URL}/{locale}/plans" style="background:{PRIMARY}; color:white; padding:10px 20px; text-decoration:none; border-radius:6px;">Renew plan</a></p>
    """
    ar = f"""
    <h2>مرحباً {name}،</h2>
    <p>خطتك <strong>{plan_title}</strong> تنتهي خلال {days_left} يوماً. هل تريد تجديدها بتوصيات ذكاء اصطناعي جديدة؟</p>
    <p><a href="{settings.FRONTEND_URL}/{locale}/plans" style="background:{PRIMARY}; color:white; padding:10px 20px; text-decoration:none; border-radius:6px;">تجديد الخطة</a></p>
    """
    return subject, _wrap(en, ar), f"Your plan ends in {days_left} days."


TEMPLATES: dict[str, Any] = {
    "welcome": build_welcome,
    "verify_email": build_verify_email,
    "onboarding_day_1": build_onboarding_day_1,
    "onboarding_day_3": build_onboarding_day_3,
    "onboarding_day_7": build_onboarding_day_7,
    "weekly_report": build_weekly_report,
    "plan_expiring_soon": build_plan_expiring_soon,
}


def render(template_name: str, context: dict[str, Any], locale: str = "en") -> tuple[str, str, str]:
    builder = TEMPLATES.get(template_name)
    if not builder:
        raise ValueError(f"Unknown template: {template_name}")
    return builder(locale=locale, **context)
