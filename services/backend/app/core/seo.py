"""SERP & SEO data providers.

Provider precedence:
  1. Serper.dev (if SERPER_API_KEY set)
  2. Google Custom Search JSON API (if GOOGLE_CSE_API_KEY + GOOGLE_CSE_ID set)
  3. Stub mode (returns deterministic fake data — safe for dev/tests)

All functions are non-raising on network failures: they fall back to stub data
so upstream callers never crash.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)


SERP_FEATURE_HINTS = ("ai_overview", "featured_snippet", "people_also_ask", "knowledge_graph")


async def serp_search(
    query: str,
    location: str = "Egypt",
    hl: str = "ar",
    num: int = 10,
) -> list[dict[str, Any]]:
    """Run a SERP search. Returns a list of {title, link, snippet, position}."""
    if settings.SERPER_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=20.0) as c:
                resp = await c.post(
                    "https://google.serper.dev/search",
                    headers={"X-API-KEY": settings.SERPER_API_KEY, "Content-Type": "application/json"},
                    json={"q": query, "location": location, "hl": hl, "num": num},
                )
                resp.raise_for_status()
                data = resp.json()
                organic = data.get("organic", [])
                # Normalise output shape
                return [
                    {
                        "title": o.get("title"),
                        "link": o.get("link"),
                        "snippet": o.get("snippet"),
                        "position": o.get("position", idx + 1),
                    }
                    for idx, o in enumerate(organic)
                ]
        except Exception as e:  # noqa: BLE001
            log.warning("Serper search failed for %r: %s", query, e)

    if settings.GOOGLE_CSE_API_KEY and settings.GOOGLE_CSE_ID:
        try:
            async with httpx.AsyncClient(timeout=20.0) as c:
                resp = await c.get(
                    "https://www.googleapis.com/customsearch/v1",
                    params={
                        "key": settings.GOOGLE_CSE_API_KEY,
                        "cx": settings.GOOGLE_CSE_ID,
                        "q": query,
                        "num": min(num, 10),
                        "hl": hl,
                    },
                )
                resp.raise_for_status()
                items = resp.json().get("items", [])
                return [
                    {
                        "title": i.get("title"),
                        "link": i.get("link"),
                        "snippet": i.get("snippet"),
                        "position": idx + 1,
                    }
                    for idx, i in enumerate(items)
                ]
        except Exception as e:  # noqa: BLE001
            log.warning("Google CSE search failed for %r: %s", query, e)

    # Stub fallback
    return [
        {
            "title": f"[stub] Result {i + 1} for {query}",
            "link": f"https://example.com/{i}",
            "snippet": f"Example snippet for {query}",
            "position": i + 1,
        }
        for i in range(min(num, 10))
    ]


async def find_ranking(
    query: str,
    target_domain: str,
    location: str = "Egypt",
    hl: str = "ar",
) -> dict[str, Any]:
    """Find the ranking position of `target_domain` for `query`."""
    target = (target_domain or "").lower().replace("https://", "").replace("http://", "").strip("/")
    if not target:
        return {"position": None, "url": None, "title": None}

    results = await serp_search(query, location=location, hl=hl, num=100)
    for idx, r in enumerate(results):
        link = (r.get("link") or "").lower()
        if target in link:
            return {
                "position": r.get("position") or (idx + 1),
                "url": r.get("link"),
                "title": r.get("title"),
                "serp_features": [],
            }
    return {"position": None, "url": None, "title": None, "serp_features": []}


async def keyword_metrics(keyword: str, location_code: int = 2818) -> dict[str, Any]:
    """Return {search_volume, cpc, competition, difficulty}.

    Uses DataForSEO when credentials are configured; otherwise returns a stub.
    Default location_code 2818 = Egypt.
    """
    if settings.DATAFORSEO_LOGIN and settings.DATAFORSEO_PASSWORD:
        try:
            auth = (settings.DATAFORSEO_LOGIN, settings.DATAFORSEO_PASSWORD)
            async with httpx.AsyncClient(timeout=30.0, auth=auth) as c:
                resp = await c.post(
                    "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live",
                    json=[{"keywords": [keyword], "location_code": location_code}],
                )
                resp.raise_for_status()
                data = resp.json()
                tasks = data.get("tasks") or []
                if tasks:
                    result = (tasks[0].get("result") or [{}])[0] or {}
                    return {
                        "search_volume": result.get("search_volume"),
                        "cpc": result.get("cpc"),
                        "competition": result.get("competition_index"),
                        "difficulty": None,
                    }
        except Exception as e:  # noqa: BLE001
            log.warning("DataForSEO lookup failed for %r: %s", keyword, e)

    return {
        "search_volume": None,
        "cpc": None,
        "competition": None,
        "difficulty": None,
        "note": "no_provider_configured",
    }
