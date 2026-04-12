"""Email utilities — dev-mode logs to console; production would use SMTP."""
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_email(to: str, subject: str, html: str, text: str) -> None:
    """Send an email. In dev (no SMTP_HOST), log contents to console."""
    if not settings.SMTP_HOST:
        logger.warning(
            "\n========== [DEV EMAIL] ==========\n"
            "To: %s\nSubject: %s\n---\n%s\n=================================\n",
            to, subject, text,
        )
        print(f"\n[DEV EMAIL] To: {to}\nSubject: {subject}\n{text}\n")
        return

    # Production SMTP (stdlib, synchronous — acceptable for MVP)
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, [to], msg.as_string())
    except Exception as e:
        logger.exception("Failed to send email to %s: %s", to, e)


def build_verification_email(name: str, link: str, locale: str = "en") -> tuple[str, str, str]:
    """Build bilingual (AR + EN) email. Returns (subject, html, text)."""
    subject = "Verify your email — تأكيد بريدك الإلكتروني | Ignify"

    html = f"""<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; padding: 20px 0;">
    <h1 style="color: #f97316;">Ignify</h1>
  </div>

  <!-- English -->
  <div style="direction: ltr; text-align: left; padding: 20px; border-bottom: 1px solid #eee;">
    <h2>Hi {name},</h2>
    <p>Thanks for signing up to Ignify! Please confirm your email address by clicking the button below:</p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="{link}" style="background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify Email</a>
    </p>
    <p style="font-size: 12px; color: #666;">Or paste this link into your browser:<br/><a href="{link}">{link}</a></p>
    <p style="font-size: 12px; color: #666;">This link expires in {settings.EMAIL_VERIFICATION_EXPIRE_HOURS} hours.</p>
  </div>

  <!-- Arabic -->
  <div style="direction: rtl; text-align: right; padding: 20px;">
    <h2>مرحباً {name}،</h2>
    <p>شكراً لتسجيلك في Ignify! يرجى تأكيد بريدك الإلكتروني بالضغط على الزر أدناه:</p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="{link}" style="background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">تأكيد البريد الإلكتروني</a>
    </p>
    <p style="font-size: 12px; color: #666;">أو انسخ هذا الرابط في متصفحك:<br/><a href="{link}">{link}</a></p>
    <p style="font-size: 12px; color: #666;">ينتهي هذا الرابط خلال {settings.EMAIL_VERIFICATION_EXPIRE_HOURS} ساعة.</p>
  </div>
</body>
</html>"""

    text = f"""Hi {name},

Thanks for signing up to Ignify! Please confirm your email by visiting:
{link}

This link expires in {settings.EMAIL_VERIFICATION_EXPIRE_HOURS} hours.

---

مرحباً {name}،

شكراً لتسجيلك في Ignify! يرجى تأكيد بريدك الإلكتروني بزيارة:
{link}

ينتهي هذا الرابط خلال {settings.EMAIL_VERIFICATION_EXPIRE_HOURS} ساعة.
"""

    return subject, html, text
