"""CreativeBriefBuilder — turn a content post + platform + brand into a
structured creative spec that downstream stages (prompt optimizer, image
generator) can consume deterministically.

Why a dedicated brief stage
---------------------------
Before Phase 8, the creative pipeline went straight to the prompt engineer
with a freeform `idea` string. The prompt engineer had to re-invent the
wheel on every call: what aspect ratio? what platform? should the image
leave room for text overlay? is the CTA in-image or in-caption? Results
were inconsistent because decisions were implicit.

Now the brief builder is the one place that answers those questions.
Output is a strict schema so the next node doesn't have to parse prose.

Schema
------
    {
      "creative_type":     "product_hero" | "lifestyle" | "testimonial" |
                           "announcement" | "educational" | "quote_card",
      "aspect_ratio":      "1:1" | "4:5" | "9:16" | "16:9",
      "style":             "minimal" | "bold" | "warm" | "luxury" |
                           "corporate" | "playful",
      "cta":               short string (≤ 60 chars) or null,
      "visual_elements":   list of concrete objects/scenes to include,
      "include_text":      bool — should the image contain text?
      "text_placement":    "top" | "center" | "bottom" | null,
      "brand_colors":      list of hex strings (passed through from tenant),
      "mood":              one-word emotional tone,
      "confidence":        "low" | "medium" | "high"
    }

`include_text=false` is the default — most social platforms prefer
image-only + caption overlay handled separately. The brief builder
explicitly sets `include_text=true` only when creative_type warrants it
(quote_card, announcement).
"""
from __future__ import annotations

import json as _json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import BaseSubAgent


# Platform → sensible default aspect ratio. Brief agent can override; this
# is the fallback when the LLM doesn't commit to one.
_PLATFORM_DEFAULTS: dict[str, str] = {
    "instagram": "4:5",
    "instagram_story": "9:16",
    "facebook": "1:1",
    "twitter": "16:9",
    "x": "16:9",
    "linkedin": "1:1",
    "tiktok": "9:16",
    "youtube": "16:9",
    "whatsapp": "1:1",
}


_VALID_TYPES = {
    "product_hero", "lifestyle", "testimonial",
    "announcement", "educational", "quote_card",
}
_VALID_RATIOS = {"1:1", "4:5", "9:16", "16:9", "4:3", "3:4"}
_VALID_STYLES = {"minimal", "bold", "warm", "luxury", "corporate", "playful"}


class CreativeBriefBuilder(BaseSubAgent):
    name = "creative_brief_builder"
    model_tier = "balanced"
    system_prompt = (
        "You are a senior art director. Turn a content post + target platform "
        "+ brand identity into a STRUCTURED creative brief the image generator "
        "can execute without guesswork. Return a single JSON object only — "
        "no prose, no markdown fences.\n\n"
        "Required fields:\n"
        "- creative_type: one of product_hero | lifestyle | testimonial | "
        "announcement | educational | quote_card\n"
        "- aspect_ratio: 1:1 | 4:5 | 9:16 | 16:9 (match platform conventions)\n"
        "- style: minimal | bold | warm | luxury | corporate | playful\n"
        "- cta: ≤60 char call-to-action shown ON the image (or null if "
        "include_text=false)\n"
        "- visual_elements: 3-6 concrete objects/scenes (NOT vague — say "
        "'wooden table with espresso cup and steam', not 'coffee vibe')\n"
        "- include_text: boolean. True ONLY for quote_card or announcement.\n"
        "- text_placement: top | center | bottom | null\n"
        "- mood: one word — calm, urgent, joyful, trustworthy, sophisticated\n"
        "- confidence: low | medium | high\n\n"
        "Rules:\n"
        " - Match the platform: Instagram Stories → 9:16; LinkedIn → 1:1; etc.\n"
        " - Respect brand_colors if provided — return them in brand_colors field.\n"
        " - Keep visual_elements achievable by Flux — no complex multi-scene "
        "composites, no text-heavy designs unless include_text=true.\n"
        " - Never invent celebrity names, copyrighted characters, or trademarked "
        "products the tenant doesn't own."
    )

    async def execute(self, state: dict[str, Any]) -> dict[str, Any]:
        content = state.get("content_text") or state.get("idea") or ""
        platform = (state.get("platform") or "").lower()
        brand = state.get("brand") or {}
        brand_colors = brand.get("colors", {}) or {}
        color_list = [
            v for v in (
                brand_colors.get("primary"),
                brand_colors.get("secondary"),
                brand_colors.get("accent"),
            )
            if isinstance(v, str) and v.startswith("#")
        ]
        language = state.get("language", "en")

        user = (
            f"Content post text:\n{content[:2000]}\n\n"
            f"Target platform: {platform or 'unspecified'}\n"
            f"Platform default aspect_ratio (hint): {_PLATFORM_DEFAULTS.get(platform, '1:1')}\n"
            f"Brand: {_json.dumps({'name': brand.get('brand_name'), 'tone': brand.get('tone'), 'voice': brand.get('brand_voice')}, ensure_ascii=False)}\n"
            f"Brand colors (hex): {color_list}\n"
            f"Language context: {language}\n\n"
            "Return the JSON brief. Be specific about visual_elements."
        )
        try:
            resp = await self.llm.ainvoke(
                [SystemMessage(content=self.system_prompt), HumanMessage(content=user)]
            )
            text = (resp.content or "").strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                text = text.rsplit("```", 1)[0]
            brief = _json.loads(text)
            if not isinstance(brief, dict):
                brief = {}
        except Exception:  # noqa: BLE001
            brief = {}

        # Validate + normalize. We clamp rather than fail so one bad LLM
        # response doesn't kill creative gen — safe defaults are usable.
        brief.setdefault("creative_type", "lifestyle")
        if brief["creative_type"] not in _VALID_TYPES:
            brief["creative_type"] = "lifestyle"

        brief.setdefault("aspect_ratio", _PLATFORM_DEFAULTS.get(platform, "1:1"))
        if brief["aspect_ratio"] not in _VALID_RATIOS:
            brief["aspect_ratio"] = _PLATFORM_DEFAULTS.get(platform, "1:1")

        brief.setdefault("style", "minimal")
        if brief["style"] not in _VALID_STYLES:
            brief["style"] = "minimal"

        brief.setdefault("cta", None)
        brief.setdefault("visual_elements", [])
        if not isinstance(brief["visual_elements"], list):
            brief["visual_elements"] = []

        # Coerce include_text to bool, default false for safety.
        brief["include_text"] = bool(brief.get("include_text", False))
        brief.setdefault("text_placement", None)
        if not brief["include_text"]:
            brief["text_placement"] = None
            # CTA without text makes no sense — drop it.
            brief["cta"] = None

        # Always pass the tenant's brand colors through — the prompt
        # optimizer expects them in the brief so the image uses the right
        # palette even if the LLM ignored the hint.
        brief["brand_colors"] = color_list

        brief.setdefault("mood", "professional")
        brief.setdefault("confidence", "medium")
        if brief["confidence"] not in ("low", "medium", "high"):
            brief["confidence"] = "medium"

        return {"brief": brief}
