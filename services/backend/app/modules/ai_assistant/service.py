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
    """Extract business details from a website URL via scraping + LLM."""
    if not url:
        return {}
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    html = await _fetch_html(url)
    meta = _extract_meta(html, url)

    if not meta:
        return {"website": url, "error": "could_not_fetch"}

    system = (
        "You analyze business websites and extract structured metadata. "
        "Reply with a single JSON object only — no prose, no markdown."
        + (" Return all string values in Arabic." if lang == "ar" else "")
    )
    user = (
        f"Website: {url}\n"
        f"Page title: {meta.get('title','')}\n"
        f"Meta description: {meta.get('description','')}\n"
        f"OG title: {meta.get('og_title','')}\n"
        f"OG description: {meta.get('og_description','')}\n"
        f"H1: {meta.get('h1','')}\n"
        f"First paragraphs:\n- " + "\n- ".join(meta.get("paragraphs") or []) + "\n\n"
        "Return JSON with keys: business_name, industry, description (2 sentences), "
        "target_audience, main_products (array of 3-5 strings), "
        "main_services (array of 3-5 strings), brand_tone "
        "(one of: professional, friendly, playful, luxury, bold, educational), "
        "probable_competitors (array of objects with real name and real url — ONLY include real known companies, "
        "never use placeholders like 'Company XYZ', 'ABC Corp', or fictional names; if unsure return empty array)."
    )
    ai = await _llm_json(system, user)

    # Filter out obvious placeholder competitor names
    _PLACEHOLDER_PATTERNS = ("xyz", "abc", "example", "company a", "company b", "شركة xyz", "شركة abc")
    raw_comps = ai.get("probable_competitors") or []
    clean_comps = [
        c for c in raw_comps
        if isinstance(c, (dict, str))
        and not any(p in str(c).lower() for p in _PLACEHOLDER_PATTERNS)
    ]

    # Merge: prefer AI values, fall back to scraped meta
    result = {
        "website": url,
        "business_name": ai.get("business_name") or meta.get("title") or "",
        "industry": ai.get("industry") or "",
        "description": ai.get("description") or meta.get("description") or meta.get("og_description") or "",
        "target_audience": ai.get("target_audience") or "",
        "main_products": ai.get("main_products") or [],
        "main_services": ai.get("main_services") or [],
        "brand_tone": ai.get("brand_tone") or "friendly",
        "probable_competitors": clean_comps,
        "logo_url": meta.get("logo_url") or "",
        "color_hints": meta.get("color_hints") or [],
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
) -> list[dict[str, Any]]:
    if not business_name:
        return []
    products = products or []
    system = (
        "You are a market research analyst specializing in identifying DIRECT competitors — "
        "companies that offer the SAME core service to the SAME target customers in the SAME market. "
        "Reply with a single JSON object that contains a key 'competitors' whose value is an array. "
        "CRITICAL: read the business description carefully and understand what the company actually does "
        "before listing competitors. Do NOT list companies in adjacent or unrelated industries."
    )
    context_lines = [f"Business name: {business_name}"]
    if website:
        context_lines.append(f"Website: {website}")
    if industry:
        context_lines.append(f"Industry label: {industry}")
    if country:
        context_lines.append(f"Country/market: {country}")
    if description:
        context_lines.append(f"What they do: {description}")
    if products:
        context_lines.append("Main products/services: " + ", ".join(products[:8]))
    context = "\n".join(context_lines)

    user = (
        f"{context}\n\n"
        "Find 5 REAL direct competitors — companies offering the same core service to the same customer segment. "
        "For each: name, url (real homepage), description (1 sentence of what they do), "
        "positioning (how they differentiate), estimated_size (startup/small/medium/large). "
        "Only list real, verifiable companies. If you are not sure a competitor is truly direct, skip it."
        + (" Return names and descriptions in Arabic." if lang == "ar" else "")
        + " Return JSON: {\"competitors\": [...]}."
    )
    # perplexity/sonar has web-search; fall back to a cheaper chat model if unavailable.
    ai = await _llm_json(system, user, model="perplexity/sonar", temperature=0.2)
    if not ai:
        ai = await _llm_json(system, user, model="openai/gpt-4o", temperature=0.2)
    comps = ai.get("competitors") if isinstance(ai, dict) else None
    if not isinstance(comps, list):
        return []

    # Filter placeholder names
    placeholders = ("xyz", "abc", "example", "company a", "company b", "شركة xyz", "شركة abc")
    clean = [
        c for c in comps
        if isinstance(c, (dict, str))
        and not any(p in str(c).lower() for p in placeholders)
    ]
    return clean[:5]


async def generate_business_profile_draft(
    website_url: str, lang: str = "en", country: str = ""
) -> dict[str, Any]:
    """One-shot: scrape site, extract logo colors, discover competitors."""
    site = await analyze_website(website_url, lang=lang)
    logo_url = site.get("logo_url") or ""
    brand = await extract_brand_from_logo(logo_url) if logo_url else {}
    competitors = site.get("probable_competitors") or []
    if not competitors and site.get("business_name"):
        competitors = await discover_competitors(
            site["business_name"], site.get("industry", ""), country=country, lang=lang
        )
    return {
        **site,
        "brand_colors": brand,
        "probable_competitors": competitors,
    }
