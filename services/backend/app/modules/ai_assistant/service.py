"""AI-assisted onboarding/settings helpers.

All external AI calls go through ``app.core.llm.get_llm`` (OpenRouter). Every
entry point is stub-safe: if the API key is missing or a network step fails
the function still returns a best-effort dict so the frontend can proceed.
"""
from __future__ import annotations

import json
import logging
import re
from collections import Counter
from io import BytesIO
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx

from app.core.config import settings
from app.core.llm import get_llm

logger = logging.getLogger(__name__)

_UA = "Mozilla/5.0 (compatible; IgnifyBot/1.0; +https://ignify.app)"
_FETCH_TIMEOUT = 20.0


# ─── Website scraping ────────────────────────────────────────────────────────

async def _fetch_html(url: str) -> str:
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    try:
        async with httpx.AsyncClient(
            timeout=_FETCH_TIMEOUT, follow_redirects=True, headers={"User-Agent": _UA}
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.text
    except Exception as exc:  # noqa: BLE001
        logger.warning("fetch_html failed for %s: %s", url, exc)
        return ""


def _extract_internal_links(html: str, base_url: str) -> list[str]:
    """Return up to 8 internal page URLs worth crawling (about/services/contact etc.)."""
    try:
        from bs4 import BeautifulSoup  # type: ignore
    except ImportError:
        return []
    if not html:
        return []

    parsed = urlparse(base_url)
    base_domain = f"{parsed.scheme}://{parsed.netloc}"

    soup = BeautifulSoup(html, "lxml")
    seen: set[str] = set()
    results: list[str] = []

    # Priority slugs that typically carry rich business info
    priority = ("about", "service", "خدمات", "من-نحن", "about-us", "our-service",
                 "contact", "who-we-are", "what-we-do", "solutions", "product", "team")

    all_links: list[str] = []
    for a in soup.find_all("a", href=True):
        href: str = a["href"].strip()
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        full = urljoin(base_url, href)
        fp = urlparse(full)
        # Keep only same-domain, non-file links
        if fp.netloc != parsed.netloc:
            continue
        if fp.path.split(".")[-1].lower() in ("pdf", "jpg", "png", "gif", "svg", "zip"):
            continue
        if full not in seen:
            seen.add(full)
            all_links.append(full)

    # Sort priority slugs first
    def _priority(u: str) -> int:
        low = u.lower()
        for i, kw in enumerate(priority):
            if kw in low:
                return i
        return len(priority)

    all_links.sort(key=_priority)
    return all_links[:8]


async def _fetch_page_text(url: str) -> str:
    """Fetch a page and return plain text (no HTML tags), max ~2000 chars."""
    html = await _fetch_html(url)
    if not html:
        return ""
    try:
        from bs4 import BeautifulSoup  # type: ignore
        soup = BeautifulSoup(html, "lxml")
        # Remove script/style noise
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        text = soup.get_text(" ", strip=True)
        # Collapse whitespace and truncate
        text = re.sub(r"\s+", " ", text).strip()
        return text[:2000]
    except Exception:  # noqa: BLE001
        return ""


def _extract_meta(html: str, base_url: str) -> dict[str, Any]:
    """Pull title / description / og tags / logo / first paragraphs."""
    try:
        from bs4 import BeautifulSoup  # type: ignore
    except ImportError:
        return {}

    if not html:
        return {}

    soup = BeautifulSoup(html, "lxml")

    def _meta(name: str, attr: str = "name") -> str:
        el = soup.find("meta", attrs={attr: name})
        return (el.get("content") or "").strip() if el else ""

    title = (soup.title.string.strip() if soup.title and soup.title.string else "") or ""
    description = _meta("description")
    og_title = _meta("og:title", attr="property")
    og_description = _meta("og:description", attr="property")
    og_image = _meta("og:image", attr="property")

    # Logo: icon / apple-touch-icon / og:image
    logo_url = ""
    for rel in ("icon", "shortcut icon", "apple-touch-icon"):
        link = soup.find("link", rel=lambda v: v and rel in v)
        if link and link.get("href"):
            logo_url = urljoin(base_url, link["href"])
            break
    if not logo_url and og_image:
        logo_url = urljoin(base_url, og_image)

    h1 = (soup.find("h1").get_text(" ", strip=True) if soup.find("h1") else "") or ""
    paragraphs = [
        p.get_text(" ", strip=True)
        for p in soup.find_all("p")[:10]
        if len(p.get_text(strip=True)) > 40
    ][:3]

    # Inline style color hints (very rough)
    colors = _scrape_color_hints(html)

    return {
        "title": title,
        "description": description,
        "og_title": og_title,
        "og_description": og_description,
        "logo_url": logo_url,
        "h1": h1,
        "paragraphs": paragraphs,
        "color_hints": colors,
    }


def _scrape_color_hints(html: str) -> list[str]:
    hexes = re.findall(r"#([0-9A-Fa-f]{6})\b", html)
    counter = Counter(h.lower() for h in hexes)
    # Skip pure black/white noise
    skip = {"000000", "ffffff", "fff", "000"}
    filtered = [f"#{h}" for h, _ in counter.most_common(30) if h not in skip]
    return filtered[:5]


# ─── LLM helpers ─────────────────────────────────────────────────────────────

def _llm_available() -> bool:
    return bool(getattr(settings, "OPENROUTER_API_KEY", None))


async def _llm_json(
    system: str, user: str, model: str = "openai/gpt-4o-mini", temperature: float = 0.4
) -> dict[str, Any]:
    """Call the LLM and parse a JSON object from the response. Stub-safe."""
    if not _llm_available():
        return {}
    try:
        llm = get_llm(model=model, temperature=temperature, max_tokens=1500)
        resp = await llm.ainvoke(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ]
        )
        text = getattr(resp, "content", "") or ""
        # Strip markdown fences if present
        text = text.strip()
        if text.startswith("```"):
            text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
            text = text.rsplit("```", 1)[0]
        # Extract the outermost JSON object
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            return {}
        return json.loads(match.group(0))
    except Exception as exc:  # noqa: BLE001
        logger.warning("_llm_json failed: %s", exc)
        return {}


# ─── Public API ──────────────────────────────────────────────────────────────

async def analyze_website(url: str, lang: str = "en") -> dict[str, Any]:
    """Extract business details by crawling homepage + key internal pages, then LLM analysis."""
    if not url:
        return {}
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    # ── Step 1: fetch homepage ───────────────────────────────────────────────
    homepage_html = await _fetch_html(url)
    meta = _extract_meta(homepage_html, url)
    if not meta:
        return {"website": url, "error": "could_not_fetch"}

    # ── Step 2: discover and crawl internal pages (about/services/contact…) ─
    internal_links = _extract_internal_links(homepage_html, url)
    import asyncio as _asyncio
    page_texts: list[str] = []
    if internal_links:
        tasks = [_fetch_page_text(link) for link in internal_links[:5]]
        results = await _asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, str) and r:
                page_texts.append(r[:1500])

    # ── Step 3: build rich LLM prompt ───────────────────────────────────────
    pages_block = ""
    if page_texts:
        pages_block = "\n\nADDITIONAL PAGES CONTENT:\n" + "\n---\n".join(page_texts)

    system = (
        "You are an expert business analyst. You analyze multi-page website content and extract "
        "rich structured business intelligence. Reply with a single JSON object only — no prose, no markdown."
        + (" Return all string values in Arabic." if lang == "ar" else "")
    )
    user = (
        f"Website: {url}\n"
        f"Page title: {meta.get('title','')}\n"
        f"Meta description: {meta.get('description','')}\n"
        f"OG description: {meta.get('og_description','')}\n"
        f"H1: {meta.get('h1','')}\n"
        f"Homepage paragraphs:\n- " + "\n- ".join(meta.get("paragraphs") or [])
        + pages_block + "\n\n"
        "Analyze ALL the content above carefully and return JSON with these keys:\n"
        "- business_name: string\n"
        "- industry: specific industry/niche (e.g. 'Construction HR outsourcing Saudi Arabia', not just 'HR')\n"
        "- description: 2-3 sentences describing exactly what the company does\n"
        "- target_audience: who are the primary buyers (role, company size, sector, geography)\n"
        "- geography: country and cities of operation (extracted from content)\n"
        "- company_size_estimate: 'startup'|'small'|'medium'|'large'\n"
        "- main_services: array of 5-8 specific services (be specific, not generic)\n"
        "- main_products: array of 3-5 specific products (or [] if service company)\n"
        "- unique_advantages: array of 3-5 competitive advantages you can infer from the content\n"
        "- brand_tone: one of professional|friendly|playful|luxury|bold|educational\n"
        "- probable_competitors: array of objects {name, url} — ONLY real known companies in the SAME market, "
        "never placeholders like 'Company XYZ'. If unsure, return []."
    )
    ai = await _llm_json(system, user, model="openai/gpt-4o-mini", temperature=0.3)

    _PLACEHOLDER_PATTERNS = ("xyz", "abc", "example", "company a", "company b", "شركة xyz", "شركة abc")
    raw_comps = ai.get("probable_competitors") or []
    clean_comps = [
        c for c in raw_comps
        if isinstance(c, (dict, str))
        and not any(p in str(c).lower() for p in _PLACEHOLDER_PATTERNS)
    ]

    result = {
        "website": url,
        "business_name": ai.get("business_name") or meta.get("title") or "",
        "industry": ai.get("industry") or "",
        "description": ai.get("description") or meta.get("description") or "",
        "target_audience": ai.get("target_audience") or "",
        "geography": ai.get("geography") or "",
        "company_size_estimate": ai.get("company_size_estimate") or "medium",
        "main_products": ai.get("main_products") or [],
        "main_services": ai.get("main_services") or [],
        "unique_advantages": ai.get("unique_advantages") or [],
        "brand_tone": ai.get("brand_tone") or "professional",
        "probable_competitors": clean_comps,
        "logo_url": meta.get("logo_url") or "",
        "color_hints": meta.get("color_hints") or [],
        "pages_crawled": len(page_texts) + 1,
    }
    return result


# ─── Logo → colors ───────────────────────────────────────────────────────────

def _rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    return "#{:02X}{:02X}{:02X}".format(*rgb)


async def extract_brand_from_logo(logo_url: str) -> dict[str, Any]:
    """Download a logo and pick dominant colors. Safe fallback on any failure."""
    if not logo_url:
        return {}
    try:
        from PIL import Image  # type: ignore
    except ImportError:
        return {}

    try:
        async with httpx.AsyncClient(timeout=_FETCH_TIMEOUT, headers={"User-Agent": _UA}) as client:
            resp = await client.get(logo_url)
            resp.raise_for_status()
            raw = resp.content
        img = Image.open(BytesIO(raw))
        has_transparency = img.mode in ("RGBA", "LA") or (
            img.mode == "P" and "transparency" in img.info
        )
        img = img.convert("RGB")
        # Downsize for speed and quantize to a small palette to pull dominants
        img.thumbnail((120, 120))
        quant = img.quantize(colors=8)
        palette = quant.getpalette() or []
        counts = quant.getcolors() or []
        counts.sort(reverse=True)  # (count, idx)
        picked: list[str] = []
        skip_lum_low, skip_lum_high = 15, 240
        for _, idx in counts:
            r, g, b = palette[idx * 3 : idx * 3 + 3]
            lum = (r + g + b) / 3
            if lum < skip_lum_low or lum > skip_lum_high:
                continue
            hexv = _rgb_to_hex((r, g, b))
            if hexv not in picked:
                picked.append(hexv)
            if len(picked) >= 3:
                break
        # Pad out
        while len(picked) < 3:
            picked.append("#6b7280")
        return {
            "primary_color": picked[0],
            "secondary_color": picked[1],
            "accent_color": picked[2],
            "has_transparency": bool(has_transparency),
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("extract_brand_from_logo failed: %s", exc)
        return {}


# ─── Competitor discovery ────────────────────────────────────────────────────

async def discover_competitors(
    business_name: str,
    industry: str = "",
    country: str = "",
    lang: str = "en",
    description: str = "",
    products: list[str] | None = None,
    website: str = "",
    geography: str = "",
    target_audience: str = "",
    unique_advantages: list[str] | None = None,
) -> list[dict[str, Any]]:
    if not business_name:
        return []
    products = products or []
    unique_advantages = unique_advantages or []

    system = (
        "You are a senior market research analyst. Your task is to find the TOP 10 LARGEST and most "
        "established DIRECT competitors — companies that serve the SAME customer segment with the SAME "
        "core service in the SAME market/geography.\n"
        "RULES:\n"
        "1. ONLY list real, verifiable companies — never fictional or placeholder names.\n"
        "2. Rank by market size/dominance (largest first).\n"
        "3. Read the business description carefully — do NOT list unrelated companies.\n"
        "4. Include local/regional leaders even if not globally known.\n"
        "Reply with a single JSON object: {\"competitors\": [...]}."
    )

    context_lines = [f"Business name: {business_name}"]
    if website:
        context_lines.append(f"Website: {website}")
    if industry:
        context_lines.append(f"Specific industry: {industry}")
    if country or geography:
        context_lines.append(f"Geography/Market: {geography or country}")
    if description:
        context_lines.append(f"What they do: {description}")
    if target_audience:
        context_lines.append(f"Target customers: {target_audience}")
    if products:
        context_lines.append("Services/products: " + ", ".join(products[:10]))
    if unique_advantages:
        context_lines.append("Their competitive advantages: " + ", ".join(unique_advantages[:5]))
    context = "\n".join(context_lines)

    user = (
        f"{context}\n\n"
        "Find the TOP 10 largest direct competitors ordered by market dominance (biggest first). "
        "For each competitor return:\n"
        "- name: company name\n"
        "- url: real homepage URL\n"
        "- description: 1 sentence of exactly what they do\n"
        "- positioning: their main differentiator/claim\n"
        "- estimated_size: startup|small|medium|large|enterprise\n"
        "- threat_level: high|medium|low (how directly they compete with this business)\n"
        "- main_strength: single strongest advantage they have\n"
        "- exploitable_weakness: one visible weakness this business could exploit\n"
        "Only list real companies. Skip any you cannot verify."
        + (" Return names and descriptions in Arabic." if lang == "ar" else "")
        + "\nReturn JSON: {\"competitors\": [...]} with exactly up to 10 items."
    )

    ai = await _llm_json(system, user, model="perplexity/sonar", temperature=0.2)
    if not ai:
        ai = await _llm_json(system, user, model="openai/gpt-4o", temperature=0.2)
    comps = ai.get("competitors") if isinstance(ai, dict) else None
    if not isinstance(comps, list):
        return []

    placeholders = ("xyz", "abc", "example", "company a", "company b", "شركة xyz", "شركة abc")
    clean = [
        c for c in comps
        if isinstance(c, (dict, str))
        and not any(p in str(c).lower() for p in placeholders)
    ]
    return clean[:10]


async def generate_business_profile_draft(
    website_url: str, lang: str = "en", country: str = ""
) -> dict[str, Any]:
    """One-shot: crawl site (multi-page), extract logo colors, discover top 10 competitors."""
    site = await analyze_website(website_url, lang=lang)
    logo_url = site.get("logo_url") or ""
    brand = await extract_brand_from_logo(logo_url) if logo_url else {}

    # Always run competitor discovery with all extracted context for best results
    competitors = await discover_competitors(
        business_name=site.get("business_name") or "",
        industry=site.get("industry") or "",
        country=country or site.get("geography") or "",
        lang=lang,
        description=site.get("description") or "",
        products=(site.get("main_services") or []) + (site.get("main_products") or []),
        website=website_url,
        geography=site.get("geography") or "",
        target_audience=site.get("target_audience") or "",
        unique_advantages=site.get("unique_advantages") or [],
    )
    # Merge any homepage-detected competitors that aren't already in the discovered list
    existing_names = {str(c.get("name", c) if isinstance(c, dict) else c).lower() for c in competitors}
    for c in (site.get("probable_competitors") or []):
        c_name = str(c.get("name", c) if isinstance(c, dict) else c).lower()
        if c_name not in existing_names:
            competitors.append(c)

    return {
        **site,
        "brand_colors": brand,
        "probable_competitors": competitors[:10],
    }
