"""ContentAnalyzer — extracts themes / tone / content types / services /
pricing / offers / messaging from scraped competitor pages.

Phase 2.5 upgrade:
- Services, pricing hints, and active offers are now explicitly requested from
  the LLM so downstream GapFinder can spot positioning gaps.
- Messaging breakdown (hero claim, trust signals, CTAs) is separated from tone
  so the analyst can reason about them independently.
"""
from __future__ import annotations

import json as _json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import BaseSubAgent


class ContentAnalyzer(BaseSubAgent):
    name = "competitor_content_analyzer"
    model_tier = "balanced"
    system_prompt = (
        "You are a competitive intelligence analyst. Given scraped competitor pages "
        "(titles, headings, OG tags, body text excerpts, pricing/offer blocks), extract "
        "a STRUCTURED profile of the competitor.\n\n"
        "Return a single JSON object with these keys (use [] or null when unknown; "
        "never fabricate):\n"
        "{\n"
        '  "summary": str,                       // 2-3 sentences\n'
        '  "positioning": str,                   // one line describing how they pitch themselves\n'
        '  "tone": str,                          // professional|friendly|luxury|bold|educational|playful\n'
        '  "themes": [str, ...],                 // 3-6 content themes\n'
        '  "content_types": [str, ...],          // e.g. "long-form blog", "case studies", "product pages"\n'
        '  "services": [ { "name": str, "description": str } ],  // services/offerings\n'
        '  "products": [ { "name": str, "description": str } ],  // products (if any)\n'
        '  "pricing": {\n'
        '     "visible": true|false,             // is pricing publicly shown?\n'
        '     "model": "subscription"|"one-time"|"quote"|"freemium"|"unknown",\n'
        '     "tiers": [ { "name": str, "price": str, "features": [str, ...] } ],\n'
        '     "notes": str                       // anything notable — free trial, money-back, etc.\n'
        '  },\n'
        '  "active_offers": [ { "title": str, "type": "discount"|"free-trial"|"bundle"|"guarantee", "terms": str } ],\n'
        '  "messaging": {\n'
        '     "hero_claim": str,                 // main headline on homepage if discoverable\n'
        '     "differentiators": [str, ...],     // what they say makes them different\n'
        '     "proof_points": [str, ...],        // testimonials, client logos, awards, stats cited\n'
        '     "ctas": [str, ...]                 // primary calls-to-action\n'
        '  }\n'
        "}\n\n"
        "RULES:\n"
        " - If the data isn't present in the scrape, use null/[]/false — do NOT invent.\n"
        " - No forbidden marketing language ('guaranteed', '#1', 'best-in-class') in your analysis.\n"
        " - Keep every string under 300 chars.\n"
        "Return ONLY the JSON. No prose, no markdown fences."
    )

    async def execute(self, state: dict[str, Any]) -> dict[str, Any]:
        scraped = state.get("scraped") or []
        lang = state.get("language", "ar")
        name = state.get("name", "competitor")
        # Keep payload compact — the LLM doesn't need every paragraph.
        compact = []
        for s in scraped[:10]:
            compact.append(
                {
                    "url": s.get("url"),
                    "title": s.get("title"),
                    "og_title": s.get("og_title"),
                    "og_description": s.get("og_description"),
                    "headings": (s.get("headings") or [])[:10],
                    # Pass through body-text excerpt when the scraper provides it;
                    # pricing/offer signals live there more often than in metadata.
                    "body_excerpt": (s.get("body_text") or s.get("text") or "")[:2000],
                    "blog_links": [b.get("text") for b in (s.get("blog_links") or [])[:5]],
                }
            )
        user = (
            f"Language for descriptive text: {lang}\nCompetitor: {name}\n\n"
            f"Scraped pages:\n{_json.dumps(compact, ensure_ascii=False)[:6000]}\n\n"
            "Return the JSON analysis matching the required schema exactly."
        )
        try:
            resp = await self.llm.ainvoke(
                [SystemMessage(content=self.system_prompt), HumanMessage(content=user)]
            )
            text = (resp.content or "").strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                text = text.rsplit("```", 1)[0]
            data = _json.loads(text)
            if not isinstance(data, dict):
                data = {}
        except Exception:  # noqa: BLE001
            data = {}

        # Normalize missing fields so consumers don't KeyError.
        data.setdefault("summary", "")
        data.setdefault("positioning", "")
        data.setdefault("tone", "")
        data.setdefault("themes", [])
        data.setdefault("content_types", [])
        data.setdefault("services", [])
        data.setdefault("products", [])
        data.setdefault("pricing", {"visible": False, "model": "unknown", "tiers": [], "notes": ""})
        data.setdefault("active_offers", [])
        data.setdefault(
            "messaging",
            {"hero_claim": "", "differentiators": [], "proof_points": [], "ctas": []},
        )

        return {"analysis": data}
