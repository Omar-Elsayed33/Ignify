"""Competitor public-metadata scraper.

MVP approach: fetch the public page and extract OpenGraph + meta tags only.
No login, no private endpoints, no aggressive scraping. Rate-limited behaviour
(HTTP 429 / network errors) returns graceful stub-shaped data.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from app.core.url_safety import UnsafeURLError, validate_public_url

log = logging.getLogger(__name__)

_UA = "Mozilla/5.0 (compatible; Ignify-Bot/1.0; +https://ignify.ai)"


def _attr(tag: Any, attr: str = "content") -> str:
    try:
        return (tag.get(attr) or "").strip() if tag else ""
    except Exception:  # noqa: BLE001
        return ""


async def scrape_public_page(url: str) -> dict[str, Any]:
    """Fetch a public URL and extract title/OG metadata + headings & blog links.

    The URL must pass SSRF safety checks (public, non-loopback, non-RFC1918)
    before we make any outbound request.
    """
    if not url:
        return {"error": "no_url", "fetched_at": datetime.now(timezone.utc).isoformat()}

    try:
        safe_url = validate_public_url(url)
    except UnsafeURLError as e:
        log.warning("scrape_public_page refused unsafe URL: %s (%s)", url, e)
        return {
            "url": url,
            "error": f"unsafe_url: {e}",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }

    try:
        async with httpx.AsyncClient(
            timeout=20.0,
            follow_redirects=True,
            max_redirects=5,
            headers={"User-Agent": _UA, "Accept-Language": "en,ar;q=0.9"},
        ) as c:
            r = await c.get(safe_url)
    except Exception as e:  # noqa: BLE001
        log.info("scrape_public_page fetch failed for %s: %s", url, e)
        return {
            "url": url,
            "error": f"fetch_failed: {e}",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }

    # Defense against SSRF-via-redirect: if the server 302s us to a private IP,
    # refuse to process the response body.
    final_url = str(r.url)
    if final_url != safe_url:
        try:
            validate_public_url(final_url)
        except UnsafeURLError as e:
            log.warning("scrape_public_page redirected to unsafe URL %s: %s", final_url, e)
            return {
                "url": url,
                "error": f"unsafe_redirect: {e}",
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }

    if r.status_code != 200:
        return {
            "url": url,
            "error": f"status_{r.status_code}",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }

    try:
        from bs4 import BeautifulSoup
    except ImportError:
        return {
            "url": url,
            "error": "beautifulsoup_missing",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }

    try:
        soup = BeautifulSoup(r.text, "html.parser")
    except Exception as e:  # noqa: BLE001
        return {"url": url, "error": f"parse_failed: {e}"}

    title = (soup.title.string or "").strip() if soup.title and soup.title.string else ""
    og_title = _attr(soup.find("meta", attrs={"property": "og:title"}))
    og_desc = _attr(soup.find("meta", attrs={"property": "og:description"}))
    og_image = _attr(soup.find("meta", attrs={"property": "og:image"}))
    meta_desc = _attr(soup.find("meta", attrs={"name": "description"}))

    headings = [h.get_text(strip=True) for h in soup.find_all(["h1", "h2"])[:15]]

    # Body text excerpt — downstream competitor analyzer reads this to find
    # pricing tiers, offer copy, and differentiator language. Strip scripts /
    # styles / nav / footer so we don't bury signal in boilerplate.
    for tag in soup(["script", "style", "nav", "footer", "header", "noscript"]):
        tag.decompose()
    body_text = soup.get_text(" ", strip=True)[:5000]

    # Recent blog links (if any /blog/ href present)
    blog_links: list[dict[str, str]] = []
    seen: set[str] = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        lower = href.lower()
        if ("/blog/" in lower or "/posts/" in lower or "/articles/" in lower) and href not in seen:
            seen.add(href)
            blog_links.append({"href": href, "text": a.get_text(strip=True)[:120]})
            if len(blog_links) >= 10:
                break

    return {
        "url": url,
        "title": title,
        "og_title": og_title,
        "og_description": og_desc or meta_desc,
        "og_image": og_image,
        "headings": headings,
        "body_text": body_text,
        "blog_links": blog_links,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


async def scrape_instagram_profile(username: str) -> dict[str, Any]:
    """Best-effort public Instagram profile scrape. Returns stub when blocked."""
    uname = (username or "").strip().lstrip("@")
    if not uname:
        return {"platform": "instagram", "error": "no_username"}

    url = f"https://www.instagram.com/{uname}/"
    data = await scrape_public_page(url)
    data["platform"] = "instagram"
    data["username"] = uname
    return data
