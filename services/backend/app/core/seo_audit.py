"""On-page SEO audit — fetches a URL and scores common on-page signals.

Returns structured issue codes (translatable on the client) plus actual current
values (so the UI can show "current title" vs "suggested title").
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

log = logging.getLogger(__name__)

# code -> {severity, label_ar, label_en, fix_ar, fix_en}
ISSUE_CATALOG: dict[str, dict[str, str]] = {
    "title_missing": {
        "severity": "high",
        "label_ar": "عنوان الصفحة مفقود", "label_en": "Missing <title>",
        "fix_ar": "أضف وسم <title> واضحاً من 50-60 حرفاً يحتوي الكلمة المفتاحية الأساسية.",
        "fix_en": "Add a clear 50-60 char <title> tag containing your primary keyword.",
    },
    "title_too_long": {
        "severity": "medium",
        "label_ar": "عنوان الصفحة طويل", "label_en": "Title too long",
        "fix_ar": "اجعل العنوان أقل من 60 حرفاً لتجنب اقتصاصه في نتائج جوجل.",
        "fix_en": "Shorten the title to under 60 characters to avoid truncation in Google.",
    },
    "title_too_short": {
        "severity": "medium",
        "label_ar": "عنوان الصفحة قصير", "label_en": "Title too short",
        "fix_ar": "اجعل العنوان بين 50-60 حرفاً وأضف وصفاً جذاباً مع كلمة مفتاحية.",
        "fix_en": "Use 50-60 chars; add a compelling hook plus a primary keyword.",
    },
    "meta_desc_missing": {
        "severity": "medium",
        "label_ar": "وصف الميتا مفقود", "label_en": "Missing meta description",
        "fix_ar": "أضف وصفاً من 150-160 حرفاً يغري بالنقر ويذكر القيمة المضافة.",
        "fix_en": "Add a 150-160 char description that entices clicks and states value.",
    },
    "meta_desc_too_long": {
        "severity": "low",
        "label_ar": "وصف الميتا طويل", "label_en": "Meta description too long",
        "fix_ar": "قصّر الوصف إلى أقل من 160 حرفاً.",
        "fix_en": "Trim description to under 160 characters.",
    },
    "h1_missing": {
        "severity": "high",
        "label_ar": "لا يوجد عنوان H1", "label_en": "No <h1> found",
        "fix_ar": "أضف <h1> واحداً يحتوي الكلمة المفتاحية الأساسية في بداية الصفحة.",
        "fix_en": "Add a single <h1> near the top containing your primary keyword.",
    },
    "h1_multiple": {
        "severity": "low",
        "label_ar": "أكثر من عنوان H1", "label_en": "Multiple <h1> tags",
        "fix_ar": "احتفظ بعنوان H1 واحد فقط لكل صفحة.",
        "fix_en": "Keep a single <h1> per page.",
    },
    "images_no_alt": {
        "severity": "medium",
        "label_ar": "صور بدون نص بديل", "label_en": "Images missing alt text",
        "fix_ar": "أضف نص بديل وصفي لكل صورة (مفيد للسيو ولذوي الاحتياجات).",
        "fix_en": "Add descriptive alt text to every image (helps SEO + accessibility).",
    },
    "viewport_missing": {
        "severity": "high",
        "label_ar": "وسم viewport مفقود", "label_en": "Missing viewport meta",
        "fix_ar": "أضف <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/> لتحسين تجربة الجوال.",
        "fix_en": "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/> for mobile.",
    },
    "canonical_missing": {
        "severity": "low",
        "label_ar": "وسم canonical مفقود", "label_en": "Missing canonical link",
        "fix_ar": "أضف <link rel=\"canonical\" href=\"...\"/> لمنع تكرار المحتوى.",
        "fix_en": "Add <link rel=\"canonical\" href=\"...\"/> to prevent duplicate content.",
    },
    "no_https": {
        "severity": "high",
        "label_ar": "الموقع لا يستخدم HTTPS", "label_en": "Not served over HTTPS",
        "fix_ar": "فعّل شهادة SSL (Let's Encrypt مجانية).",
        "fix_en": "Enable SSL (Let's Encrypt is free).",
    },
    "og_missing": {
        "severity": "low",
        "label_ar": "وسوم OpenGraph مفقودة", "label_en": "Missing OpenGraph tags",
        "fix_ar": "أضف og:title, og:description, og:image للمشاركات على السوشيال.",
        "fix_en": "Add og:title, og:description, og:image for social sharing.",
    },
    "thin_content": {
        "severity": "medium",
        "label_ar": "محتوى قليل", "label_en": "Thin content",
        "fix_ar": "أضف محتوى أكثر من 500 كلمة حول الموضوع الرئيسي.",
        "fix_en": "Add more than 500 words of on-topic content.",
    },
    "fetch_failed": {
        "severity": "high",
        "label_ar": "فشل جلب الصفحة", "label_en": "Failed to fetch URL",
        "fix_ar": "تأكد من إمكانية الوصول للموقع والـ DNS.",
        "fix_en": "Verify the site is reachable and DNS resolves.",
    },
}


def _issue(code: str, current: Any = None, extra: dict | None = None) -> dict:
    info = ISSUE_CATALOG.get(code) or {}
    return {
        "code": code,
        "severity": info.get("severity", "medium"),
        "label_ar": info.get("label_ar", code),
        "label_en": info.get("label_en", code),
        "fix_ar": info.get("fix_ar", ""),
        "fix_en": info.get("fix_en", ""),
        "current": current,
        "extra": extra or {},
    }


def _suggest_title(current: str, word_count: int) -> str:
    """Lightweight fallback title suggestion when AI is unavailable."""
    base = current or "صفحة بدون عنوان"
    if len(current) < 20:
        return f"{current} | دليل شامل ومختصر للقراء"
    if len(current) > 60:
        return current[:55].rsplit(" ", 1)[0] + "…"
    return current


async def audit_url(url: str) -> dict[str, Any]:
    """Fetch `url` and produce an on-page audit report with STRUCTURED issues."""
    from app.core.url_safety import UnsafeURLError, validate_public_url

    issues: list[dict] = []
    score = 100

    try:
        url = validate_public_url(url)
    except UnsafeURLError as e:
        return {
            "score": 0,
            "issues": [_issue("unsafe_url", str(e))],
            "title": "", "meta_description": "",
            "h1": [], "h2": [], "word_count": 0,
            "images_without_alt": 0, "links_count": 0,
        }

    try:
        async with httpx.AsyncClient(
            timeout=20.0,
            follow_redirects=True,
            max_redirects=5,
            headers={"User-Agent": "Mozilla/5.0 Ignify-SEO-Bot/1.0"},
        ) as c:
            resp = await c.get(url)
    except Exception as e:  # noqa: BLE001
        return {
            "score": 0,
            "issues": [_issue("fetch_failed", str(e))],
            "title": "", "meta_description": "",
            "word_count": 0, "h1_count": 0, "img_count": 0, "img_without_alt": 0,
            "url": url, "suggested_title": "",
        }

    if resp.status_code >= 400:
        return {
            "score": 0,
            "issues": [_issue("fetch_failed", f"HTTP {resp.status_code}")],
            "title": "", "meta_description": "",
            "word_count": 0, "h1_count": 0, "img_count": 0, "img_without_alt": 0,
            "url": url, "suggested_title": "",
        }

    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(resp.text, "html.parser")
    except Exception as e:  # noqa: BLE001
        return {
            "score": 20, "issues": [_issue("fetch_failed", str(e))],
            "title": "", "meta_description": "",
            "word_count": 0, "h1_count": 0, "img_count": 0, "img_without_alt": 0,
            "url": url, "suggested_title": "",
        }

    title = (soup.title.string or "").strip() if soup.title and soup.title.string else ""
    if not title:
        issues.append(_issue("title_missing")); score -= 10
    elif len(title) > 60:
        issues.append(_issue("title_too_long", title, {"length": len(title)})); score -= 5
    elif len(title) < 20:
        issues.append(_issue("title_too_short", title, {"length": len(title)})); score -= 3

    meta_desc_tag = soup.find("meta", attrs={"name": "description"})
    meta_desc = (meta_desc_tag.get("content") or "").strip() if meta_desc_tag else ""
    if not meta_desc:
        issues.append(_issue("meta_desc_missing")); score -= 10
    elif len(meta_desc) > 160:
        issues.append(_issue("meta_desc_too_long", meta_desc, {"length": len(meta_desc)})); score -= 3

    h1s = soup.find_all("h1")
    h1_texts = [(h.get_text() or "").strip() for h in h1s]
    if len(h1s) == 0:
        issues.append(_issue("h1_missing")); score -= 10
    elif len(h1s) > 1:
        issues.append(_issue("h1_multiple", h1_texts, {"count": len(h1s)})); score -= 5

    imgs = soup.find_all("img")
    no_alt = [i for i in imgs if not (i.get("alt") or "").strip()]
    if no_alt:
        issues.append(_issue("images_no_alt", None, {"count": len(no_alt)})); score -= min(15, len(no_alt))

    if not soup.find("meta", attrs={"name": "viewport"}):
        issues.append(_issue("viewport_missing")); score -= 5
    if not soup.find("link", attrs={"rel": "canonical"}):
        issues.append(_issue("canonical_missing")); score -= 5
    if not url.lower().startswith("https://"):
        issues.append(_issue("no_https")); score -= 10
    if not soup.find("meta", attrs={"property": "og:title"}):
        issues.append(_issue("og_missing")); score -= 3

    text = soup.get_text(" ", strip=True)
    word_count = len(text.split())
    if word_count < 300:
        issues.append(_issue("thin_content", None, {"word_count": word_count})); score -= 10

    return {
        "score": max(0, score),
        "issues": issues,
        "title": title,
        "meta_description": meta_desc,
        "h1_texts": h1_texts,
        "word_count": word_count,
        "h1_count": len(h1s),
        "img_count": len(imgs),
        "img_without_alt": len(no_alt),
        "url": url,
        "suggested_title": _suggest_title(title, word_count),
    }
