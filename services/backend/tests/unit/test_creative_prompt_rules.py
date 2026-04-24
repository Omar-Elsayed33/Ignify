"""Phase 8 P3: prompt engineer rule enforcement.

The LLM-produced prompt is subject to downstream cleanup:
- Negative prompt MUST always include anti-Arabic-script guards.
- When include_text=false, negative prompt MUST ban text/letters/words.
- CTA with non-ASCII chars is stripped (no Arabic text in images, ever).

These tests use a fake LLM so we don't hit the real API — just verify the
post-processing enforces the contract.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.agents.creative.subagents.prompt_engineer import PromptEngineer


pytestmark = pytest.mark.unit


def _make_engineer(llm_response_content: str) -> PromptEngineer:
    """Instantiate PromptEngineer with a stubbed llm.ainvoke response."""
    eng = PromptEngineer.__new__(PromptEngineer)
    eng.llm = MagicMock()
    resp = MagicMock()
    resp.content = llm_response_content
    eng.llm.ainvoke = AsyncMock(return_value=resp)
    eng.name = "prompt_engineer"
    return eng


class TestNegativePromptHardening:
    async def test_include_text_false_bans_text_in_negative(self):
        """If the LLM forgets to ban text, the post-processor must add it."""
        eng = _make_engineer(
            '{"prompt": "a photo of coffee", "negative_prompt": "blurry, low quality"}'
        )
        state = {
            "brief": {
                "style": "minimal",
                "aspect_ratio": "1:1",
                "visual_elements": ["cup"],
                "include_text": False,
            },
            "language": "en",
        }
        result = await eng.execute(state)
        neg = result["negative_prompt"].lower()
        assert "text" in neg
        assert "letters" in neg or "words" in neg

    async def test_anti_arabic_always_in_negative(self):
        """Even when include_text=true, Arabic script is banned in images."""
        eng = _make_engineer(
            '{"prompt": "a quote card", "negative_prompt": "blurry"}'
        )
        state = {
            "brief": {
                "style": "minimal",
                "aspect_ratio": "1:1",
                "visual_elements": ["quote background"],
                "include_text": True,
                "cta": "Learn more",
            },
            "language": "ar",
        }
        result = await eng.execute(state)
        neg = result["negative_prompt"].lower()
        assert "arabic" in neg

    async def test_llm_negative_preserved_and_extended(self):
        """If LLM already bans text, we don't duplicate but still ensure the
        anti-Arabic guard is there."""
        eng = _make_engineer(
            '{"prompt": "x", "negative_prompt": "blurry, text, watermark"}'
        )
        state = {
            "brief": {"include_text": False, "visual_elements": []},
            "language": "en",
        }
        result = await eng.execute(state)
        neg = result["negative_prompt"]
        # Already-present `text` should appear exactly once (we don't re-add).
        assert neg.lower().count("text") == 1
        assert "arabic" in neg.lower()


class TestCTAArabicStripping:
    """CTA text ends up INSIDE the image — Arabic characters here produce
    garbled output in Flux. Strip them before passing to the prompt."""

    async def test_ascii_cta_passes_through_to_prompt_user_message(self):
        """A Latin CTA survives untouched. The LLM sees it in its input."""
        captured: list[str] = []

        eng = PromptEngineer.__new__(PromptEngineer)
        eng.name = "prompt_engineer"
        eng.llm = MagicMock()
        resp = MagicMock()
        resp.content = '{"prompt": "x", "negative_prompt": "blurry"}'

        async def _capture(messages):
            # messages[1] is the HumanMessage; snap its content for assertion.
            captured.append(messages[1].content)
            return resp

        eng.llm.ainvoke = _capture

        state = {
            "brief": {
                "include_text": True,
                "cta": "Order Now",
                "visual_elements": ["pizza"],
            },
            "language": "en",
        }
        await eng.execute(state)
        assert "Order Now" in captured[0]

    async def test_arabic_cta_stripped_from_prompt_user_message(self):
        """An Arabic CTA must NOT appear in the prompt — it would become
        scrambled letterforms in the rendered image."""
        captured: list[str] = []
        eng = PromptEngineer.__new__(PromptEngineer)
        eng.name = "prompt_engineer"
        eng.llm = MagicMock()
        resp = MagicMock()
        resp.content = '{"prompt": "x", "negative_prompt": "blurry"}'

        async def _capture(messages):
            captured.append(messages[1].content)
            return resp

        eng.llm.ainvoke = _capture

        state = {
            "brief": {
                "include_text": True,
                "cta": "اطلب الآن",  # Arabic for "Order Now"
                "visual_elements": ["pizza"],
            },
            "language": "ar",
        }
        await eng.execute(state)
        # The captured prompt-builder message should show cta: None,
        # not the Arabic original.
        assert "اطلب الآن" not in captured[0]
        assert "cta (Latin-only, only if include_text): None" in captured[0]


class TestFallbackOnLLMFailure:
    async def test_malformed_llm_response_uses_fallback_prompt(self):
        """If the LLM returns bad JSON, we still produce a usable prompt from
        the brief's visual_elements so the pipeline doesn't crash."""
        eng = _make_engineer("not json at all, just prose")
        state = {
            "brief": {
                "visual_elements": ["coffee cup", "wooden table", "morning light"],
                "include_text": False,
            },
            "language": "en",
        }
        result = await eng.execute(state)
        # Fallback should be some of the visual elements joined.
        assert "coffee cup" in result["prompt"] or "prompt" in result["prompt"]
        # Negative still has guards applied.
        assert "text" in result["negative_prompt"].lower()
        assert "arabic" in result["negative_prompt"].lower()
