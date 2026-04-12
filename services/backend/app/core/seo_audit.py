"""On-page SEO audit — fetches a URL and scores common on-page signals."""
from __future__ import annotations

import logging
from typing import Any

import httpx

log = logging.getLogger(__name__)


async def audit_url(url: str) -> dict[str, Any]:
    """Fetch `url` and produce an on-page audit report.

    Returns {score, issues, title, word_count, h1_count, img_count, img_without_alt}.
    Failures (network, non-200, parse) are returned as a low score with issues
    rather than raised.
    """
    issues: list[str] = []
    score = 100

    try:
        async with httpx.AsyncClient(
            timeout=20.0,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 Ignify-SEO-Bot/1.0"},
        ) as c:
            resp = await c.get(url)
    except Exception as e:  # noqa: BLE001
        return {
            "score": 0,
            "issues": [f"Failed to fetch URL: {e}"],
            "title": "",
            "word_count": 0,
            "h1_count": 0,
            "img_count": 0,
            "img_without_alt": 0,
            "url": url,
        }

    if resp.status_code >= 400:
        return {
            "score": 0,
            "issues": [f"URL returned HTTP {resp.status_code}"],
            "title": "",
            "word_count": 0,
            "h1_count": 0,
            "img_count": 0,
            "img_without_alt": 0,
            "url": url,
        }

    try:
        from bs4 import BeautifulSoup  # lazy import
    except ImportError:
        log.error("BeautifulSoup not installed — skipping on-page parse")
        return {
            "score": 50,
            "issues": ["BeautifulSoup missing on server; audit degraded"],
            "title": "",
            "word_count": 0,
            "h1_count": 0,
            "img_count": 0,
            "img_without_alt": 0,
            "url": url,
        }

    try:
        soup = BeautifulSoup(resp.text, "html.parser")
    except Exception as e:  # noqa: BLE001
        return {
            "score": 20,
            "issues": [f"HTML parse failed: {e}"],
            "title": "",
            "word_count": 0,
            "h1_count": 0,
            "img_count": 0,
            "img_without_alt": 0,
            "url": url,
        }

    # ── Title ──
    title = (soup.title.string or "").strip() if soup.title and soup.title.string else ""
    if not title:
        issues.append("Missing <title>")
        score -= 10
    elif len(title) > 60:
        issues.append(f"Title too long ({len(title)} chars — keep under 60)")
        score -= 5
    elif len(title) < 20:
        issues.append(f"Title too short ({len(title)} chars)")
        score -= 3

    # ── Meta description ──
    meta_desc_tag = soup.find("meta", attrs={"name": "description"})
    meta_desc = (meta_desc_tag.get("content") or "").strip() if meta_desc_tag else ""
    if not meta_desc:
        issues.append("Missing meta description")
        score -= 10
    elif len(meta_desc) > 160:
        issues.append(f"Meta description too long ({len(meta_desc)} chars)")
        score -= 3

    # ── Headings ──
    h1s = soup.find_all("h1")
    if len(h1s) == 0:
        issues.append("No <h1> found")
        score -= 10
    elif len(h1s) > 1:
        issues.append(f"Multiple <h1> tags ({len(h1s)})")
        score -= 5

    # ── Images ──
    imgs = soup.find_all("img")
    no_alt = [i for i in imgs if not (i.get("alt") or "").strip()]
    if no_alt:
        issues.append(f"{len(no_alt)} images without alt text")
        score -= min(15, len(no_alt))

    # ── Viewport / canonical / robots ──
    if not soup.find("meta", attrs={"name": "viewport"}):
        issues.append("Missing viewport meta tag (mobile)")
        score -= 5
    if not soup.find("link", attrs={"rel": "canonical"}):
        issues.append("Missing canonical link")
        score -= 5

    # ── HTTPS ──
    if not url.lower().startswith("https://"):
        issues.append("Not served over HTTPS")
        score -= 10

    # ── OpenGraph ──
    if not soup.find("meta", attrs={"property": "og:title"}):
        issues.append("Missing OpenGraph (og:title)")
        score -= 3

    # ── Content volume ──
    text = soup.get_text(" ", strip=True)
    word_count = len(text.split())
    if word_count < 300:
        issues.append(f"Thin content ({word_count} words)")
        score -= 10

    return {
        "score": max(0, score),
        "issues": issues,
        "title": title,
        "meta_description": meta_desc,
        "word_count": word_count,
        "h1_count": len(h1s),
        "img_count": len(imgs),
        "img_without_alt": len(no_alt),
        "url": url,
    }
