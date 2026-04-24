"""PromptEngineer — turn a structured CreativeBrief into a text-to-image prompt.

Phase 8 upgrade
---------------
Before: accepted a freeform `idea` string and produced a prompt.
Now: prefers `state["brief"]` (from CreativeBriefBuilder) which gives us
visual_elements, style, brand_colors, include_text, and cta. Falls back to
the old freeform path when no brief is provided (back-compat).

Hard rules enforced in the system prompt:

1. NO TEXT INSIDE THE IMAGE unless brief.include_text is true.
   Most social posts layer text on top via CSS — Flux-generated text is
   unreliable and especially bad for Arabic (RTL letters often merge).
   The negative prompt always bans "text, letters, writing, signage" for
   include_text=false briefs.

2. NO ARABIC TEXT IN IMAGES — EVER.
   Flux renders Arabic as random-shape scribbles. Even when include_text
   is true, we constrain the CTA to Latin characters. Arabic copy lives
   in the caption layer, not the image.

3. Brand colors injected into the prompt when provided.
   We tell the model "accent with ({hex1}, {hex2})" so the image at least
   gravitates toward the palette. Not guaranteed, but better than random.

4. Text-overlay space reserved.
   For posts that will have a caption overlay added downstream, we instruct
   the model to "leave negative space on the {top|bottom}" so text doesn't
   fight the subject.
"""
from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import parse_json_response


SYSTEM_PROMPT = (
    "You are an expert image-generation prompt engineer. You convert a "
    "STRUCTURED creative brief into a single Flux-compatible prompt plus a "
    "negative prompt. Favor concrete nouns, specific composition, lighting, "
    "camera angle, lens, color palette, and mood.\n\n"
    "HARD RULES — these are non-negotiable:\n"
    "1. DO NOT include any text, letters, words, numbers, logos, watermarks, "
    "or signage IN the image UNLESS the brief explicitly sets include_text=true.\n"
    "2. NEVER generate Arabic script in the image — Flux renders it as garbled "
    "shapes. If a CTA is needed, use Latin characters or (preferably) omit it "
    "and leave negative space for a text overlay added later.\n"
    "3. When include_text is false AND the content will have a caption overlay, "
    "explicitly instruct the model to leave clear negative space on the "
    "specified text_placement area (top / center / bottom).\n"
    "4. Inject brand_colors as a palette hint: 'accent with (#hex1, #hex2)'.\n"
    "5. Keep the prompt under 400 words. Flux over-weights late tokens when "
    "prompts are bloated.\n\n"
    "Negative prompt must always include: blurry, low quality, watermark, "
    "distorted faces, extra limbs, deformed hands, nsfw. For include_text=false "
    "briefs, also ban: text, letters, words, writing, signage, logos.\n\n"
    'Return STRICT JSON only: {"prompt": "...", "negative_prompt": "..."}'
)


_DEFAULT_NEGATIVE = (
    "blurry, low quality, low resolution, watermark, logo, distorted faces, "
    "extra limbs, deformed hands, deformed anatomy, jpeg artifacts, nsfw"
)
_NO_TEXT_NEGATIVE = ", text, letters, words, writing, signage, captions"
# Any non-ASCII character in the CTA is blocked so Arabic / RTL text never
# enters the image. Users' Arabic copy still flows through the caption layer.
_ARABIC_NEGATIVE = ", arabic script, arabic letters, urdu script, farsi script"


class PromptEngineer(BaseSubAgent):
    name = "prompt_engineer"
    model_tier = "balanced"
    system_prompt = SYSTEM_PROMPT

    async def execute(self, state):
        brief = state.get("brief") or {}
        idea = state.get("idea", "") or ""
        lang = state.get("language", "en")

        # Derive structured inputs from brief if present, fall back to legacy.
        style = brief.get("style") or state.get("style", "photo")
        dims = brief.get("aspect_ratio") or state.get("dimensions", "1:1")
        visual_elements = brief.get("visual_elements") or []
        include_text = bool(brief.get("include_text"))
        text_placement = brief.get("text_placement")
        brand_colors = brief.get("brand_colors") or []
        mood = brief.get("mood") or ""
        cta = brief.get("cta") if include_text else None
        # Strip non-ASCII from the CTA — images must never carry Arabic.
        if cta and any(ord(c) > 127 for c in cta):
            cta = None

        voice = state.get("brand_voice", {}) or {}

        user_prompt = (
            f"Language context (for caption only, not the image): {lang}\n"
            f"Brief summary:\n"
            f"  creative_type: {brief.get('creative_type', 'lifestyle')}\n"
            f"  style: {style}\n"
            f"  aspect_ratio: {dims}\n"
            f"  mood: {mood}\n"
            f"  visual_elements: {visual_elements}\n"
            f"  include_text: {include_text}\n"
            f"  text_placement: {text_placement}\n"
            f"  cta (Latin-only, only if include_text): {cta}\n"
            f"  brand_colors: {brand_colors}\n"
            f"  brand_voice: {voice}\n\n"
            f"Fallback idea (use only if brief is empty):\n{idea}\n\n"
            "Return the JSON now. Respect the hard rules — especially no Arabic "
            "in the image and (when include_text=false) leave negative space for "
            "a caption overlay at the specified placement."
        )

        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user_prompt),
        ])
        fallback_prompt = idea or " ".join(str(x) for x in visual_elements) or "high-quality product photo"
        data = parse_json_response(resp.content, fallback={
            "prompt": fallback_prompt,
            "negative_prompt": _DEFAULT_NEGATIVE,
        })
        prompt = (data.get("prompt") or fallback_prompt).strip()
        negative = (data.get("negative_prompt") or _DEFAULT_NEGATIVE).strip()

        # Defense-in-depth: enforce rules even if the LLM forgot.
        if not include_text and not any(k in negative.lower() for k in ("text", "letters")):
            negative = negative.rstrip(",. ") + _NO_TEXT_NEGATIVE
        if "arabic" not in negative.lower():
            negative = negative.rstrip(",. ") + _ARABIC_NEGATIVE

        return {"prompt": prompt, "negative_prompt": negative}
