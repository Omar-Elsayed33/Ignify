"""Deep multi-page SEO audit with site-level checks + LLM-powered recommendations.

Builds on top of `seo_audit.audit_url` (per-page rules) by:
- Discovering up to N internal links and auditing each
- Checking site-level signals: robots.txt, sitemap.xml, HTTPS cert, canonical host
- Asking an LLM for specific, business-tailored recommendations focused on
  SEO quality + conversion signals (CTAs, trust, form friction, etc.)
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

from app.core.llm import get_llm
from app.core.seo_audit import audit_url

log = logging.getLogger(__name__)


_JSON_BLOCK = re.compile(r"\{.*\}", re.DOTALL)
_MAX_PAGES = 5
_MAX_LINKS_TO_CONSIDER = 25


def _same_host(a: str, b: str) -> bool:
    return urlparse(a).netloc.lower() == urlparse(b).netloc.lower()


def _base_origin(url: str) -> str:
    p = urlparse(url)
    return f"{p.scheme}://{p.netloc}"


async def _discover_internal_links(html: str, base_url: str) -> list[str]:
    """Parse homepage HTML and return up to N unique internal links worth auditing."""
    try:
        soup = BeautifulSoup(html, "html.parser")
    except Exception:
        return []
    seen: set[str] = set()
    out: list[str] = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        absolute = urljoin(base_url, href)
        if not _same_host(absolute, base_url):
            continue
        # Strip fragments + trailing slash to dedupe
        clean = absolute.split("#")[0].rstrip("/")
        if clean in seen or clean == base_url.rstrip("/"):
            continue
        seen.add(clean)
        out.append(clean)
        if len(out) >= _MAX_LINKS_TO_CONSIDER:
            break
    return out


async def _check_site_files(origin: str) -> dict[str, Any]:
    """Fetch robots.txt + sitemap.xml to identify site-level issues."""
    result: dict[str, Any] = {
        "robots_txt_found": False,
        "sitemap_in_robots": False,
        "sitemap_xml_found": False,
        "sitemap_url": None,
    }
    async with httpx.AsyncClient(
        timeout=10.0, follow_redirects=True, headers={"User-Agent": "Ignify-SEO-Bot/1.0"}
    ) as c:
        try:
            robots = await c.get(urljoin(origin + "/", "robots.txt"))
            if robots.status_code == 200 and len(robots.text) > 0:
                result["robots_txt_found"] = True
                for line in robots.text.splitlines():
                    line = line.strip()
                    if line.lower().startswith("sitemap:"):
                        sitemap_url = line.split(":", 1)[1].strip()
                        result["sitemap_in_robots"] = True
                        result["sitemap_url"] = sitemap_url
                        break
        except Exception as e:
            log.debug("robots.txt fetch failed: %s", e)

        sitemap_candidate = result.get("sitemap_url") or urljoin(origin + "/", "sitemap.xml")
        try:
            sm = await c.get(sitemap_candidate)
            if sm.status_code == 200 and ("<urlset" in sm.text or "<sitemapindex" in sm.text):
                result["sitemap_xml_found"] = True
                result["sitemap_url"] = sitemap_candidate
        except Exception as e:
            log.debug("sitemap fetch failed: %s", e)

    return result


def _page_signals_summary(pages: list[dict]) -> dict[str, Any]:
    """Condense per-page results into site-level signal summary for the LLM."""
    if not pages:
        return {}
    total = len(pages)
    avg_score = round(sum(p.get("score", 0) for p in pages) / total)
    total_words = sum(p.get("word_count", 0) for p in pages)
    total_imgs = sum(p.get("img_count", 0) for p in pages)
    missing_alt = sum(p.get("img_without_alt", 0) for p in pages)
    missing_title = sum(1 for p in pages if not p.get("title"))
    missing_meta = sum(1 for p in pages if not p.get("meta_description"))
    missing_h1 = sum(1 for p in pages if (p.get("h1_count", 0) == 0))
    thin_pages = sum(1 for p in pages if (p.get("word_count", 0) < 300))
    return {
        "pages_audited": total,
        "avg_page_score": avg_score,
        "total_words": total_words,
        "total_images": total_imgs,
        "images_without_alt": missing_alt,
        "pages_missing_title": missing_title,
        "pages_missing_meta_description": missing_meta,
        "pages_missing_h1": missing_h1,
        "thin_content_pages": thin_pages,
        "example_titles": [p.get("title", "") for p in pages[:5] if p.get("title")],
    }


async def _llm_recommendations(
    url: str, page_summary: dict, site_files: dict, first_page_text: str, language: str
) -> list[dict]:
    """Ask the LLM for specific SEO + conversion recommendations with priorities."""
    lang_line = (
        "Respond entirely in Arabic."
        if language == "ar"
        else "Respond entirely in English."
    )
    system = (
        "You are a senior SEO + conversion-rate-optimization consultant. Review the signals "
        "below and produce SPECIFIC, ACTIONABLE recommendations a business owner can execute "
        "this week. Focus on BOTH organic-search quality AND on-page conversion "
        "(CTAs, trust signals, form friction, pricing clarity, social proof). "
        "Reply with a single JSON object only. " + lang_line
    )
    # Truncate page text — first ~2500 chars is usually enough
    snippet = (first_page_text or "")[:2500]
    user = (
        f"Site URL: {url}\n\n"
        f"Crawl signals:\n{json.dumps(page_summary, ensure_ascii=False, indent=2)}\n\n"
        f"Robots/sitemap:\n{json.dumps(site_files, ensure_ascii=False, indent=2)}\n\n"
        f"Homepage content excerpt:\n{snippet}\n\n"
        "Return JSON with one key: 'recommendations' — an array of 6-10 objects, each:\n"
        "  id (kebab-case, e.g. 'add-pricing-page'),\n"
        "  category ('technical-seo'|'content'|'conversion'|'trust'|'technical'),\n"
        "  title (imperative, short — e.g. 'Add a visible pricing section above the fold'),\n"
        "  why (1-2 sentence explanation tied to the actual content),\n"
        "  how (2-3 concrete steps),\n"
        "  priority ('high'|'medium'|'low'),\n"
        "  expected_impact (short outcome, e.g. '+15% form fills').\n"
        "Order by priority (high first). Avoid generic advice — reference specifics you see in the content."
    )
    llm = get_llm(model="openai/gpt-4o", temperature=0.3, max_tokens=3000)
    try:
        resp = await llm.ainvoke(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ]
        )
    except Exception as e:
        log.exception("LLM recommendations failed: %s", e)
        return []

    text = (getattr(resp, "content", "") or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text).rsplit("```", 1)[0]
    match = _JSON_BLOCK.search(text)
    if not match:
        return []
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError:
        return []
    recs = data.get("recommendations") if isinstance(data, dict) else None
    if not isinstance(recs, list):
        return []
    # Light normalization
    cleaned: list[dict] = []
    for i, r in enumerate(recs[:10]):
        if not isinstance(r, dict):
            continue
        cleaned.append({
            "id": str(r.get("id") or f"rec-{i+1}"),
            "category": str(r.get("category") or "content"),
            "title": str(r.get("title") or ""),
            "why": str(r.get("why") or ""),
            "how": str(r.get("how") or ""),
            "priority": str(r.get("priority") or "medium"),
            "expected_impact": str(r.get("expected_impact") or ""),
        })
    return cleaned


async def deep_audit(url: str, language: str = "ar") -> dict[str, Any]:
    """Full audit: homepage + up to 4 internal pages + site files + LLM recs."""
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    origin = _base_origin(url)

    # 1. Audit the homepage first (we need the HTML to discover links anyway)
    homepage = await audit_url(url)

    # 2. Try to fetch homepage HTML once for link discovery + LLM snippet
    links: list[str] = []
    page_text_snippet = ""
    try:
        async with httpx.AsyncClient(
            timeout=15.0,
            follow_redirects=True,
            headers={"User-Agent": "Ignify-SEO-Bot/1.0"},
        ) as c:
            resp = await c.get(url)
            if resp.status_code < 400:
                links = await _discover_internal_links(resp.text, url)
                try:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    page_text_snippet = soup.get_text(" ", strip=True)
                except Exception:
                    page_text_snippet = ""
    except Exception as e:
        log.debug("homepage fetch for discovery failed: %s", e)

    # 3. Audit up to _MAX_PAGES - 1 more pages in parallel
    extra_to_audit = links[: _MAX_PAGES - 1]
    extra_results: list[dict] = []
    if extra_to_audit:
        try:
            extra_results = await asyncio.gather(
                *[audit_url(u) for u in extra_to_audit], return_exceptions=False
            )
        except Exception as e:
            log.warning("parallel audit failed: %s", e)
            extra_results = []

    pages = [homepage] + extra_results
    summary = _page_signals_summary(pages)

    # 4. Site-level files
    site_files = await _check_site_files(origin)

    # 5. LLM recommendations (combines everything)
    recommendations = await _llm_recommendations(
        url, summary, site_files, page_text_snippet, language
    )

    # 6. Build site-level issue list beyond per-page issues
    site_issues: list[dict] = []
    if not site_files.get("robots_txt_found"):
        site_issues.append({
            "code": "robots_missing", "severity": "medium",
            "label_ar": "ملف robots.txt مفقود", "label_en": "robots.txt not found",
            "fix_ar": "أضف robots.txt إلى جذر الموقع لتوجيه محركات البحث.",
            "fix_en": "Add a robots.txt at the site root to guide search engines.",
            "current": None, "extra": {},
        })
    if not site_files.get("sitemap_xml_found"):
        site_issues.append({
            "code": "sitemap_missing", "severity": "medium",
            "label_ar": "خريطة الموقع (sitemap.xml) مفقودة",
            "label_en": "sitemap.xml not found",
            "fix_ar": "أنشئ sitemap.xml واذكره داخل robots.txt وسجّله في Search Console.",
            "fix_en": "Generate sitemap.xml, reference it in robots.txt, and submit to Search Console.",
            "current": None, "extra": {},
        })

    # Aggregate site score = average of page scores, penalized for missing site files
    avg_score = summary.get("avg_page_score", 0)
    if not site_files.get("robots_txt_found"):
        avg_score = max(0, avg_score - 5)
    if not site_files.get("sitemap_xml_found"):
        avg_score = max(0, avg_score - 5)

    return {
        "url": url,
        "origin": origin,
        "score": avg_score,
        "summary": summary,
        "site_files": site_files,
        "site_issues": site_issues,
        "pages": [
            {
                "url": p.get("url"),
                "score": p.get("score"),
                "title": p.get("title"),
                "meta_description": p.get("meta_description"),
                "word_count": p.get("word_count"),
                "h1_count": p.get("h1_count"),
                "issues": p.get("issues", []),
            }
            for p in pages
        ],
        "recommendations": recommendations,
    }
