"""Phase 3 P3-1 + P3-3: video-gen disabled, pricing aligned with capabilities."""
from __future__ import annotations

import os

import pytest


pytestmark = pytest.mark.unit


class TestVideoGenFlag:
    def test_flag_defaults_to_disabled(self, monkeypatch):
        monkeypatch.delenv("VIDEO_GEN_ENABLED", raising=False)
        from app.modules.video_gen.router import _video_gen_enabled
        assert _video_gen_enabled() is False

    def test_flag_accepts_truthy_values(self, monkeypatch):
        from app.modules.video_gen.router import _video_gen_enabled
        for truthy in ("1", "true", "True"):
            monkeypatch.setenv("VIDEO_GEN_ENABLED", truthy)
            assert _video_gen_enabled() is True

    def test_flag_rejects_falsy_values(self, monkeypatch):
        from app.modules.video_gen.router import _video_gen_enabled
        for falsy in ("0", "false", "no", ""):
            monkeypatch.setenv("VIDEO_GEN_ENABLED", falsy)
            assert _video_gen_enabled() is False


class TestPricingAlignment:
    def test_video_quotas_zero_until_renderer_ships(self):
        """Until the renderer is wired, no tier should promise any videos.

        Customers not being charged for a broken feature is non-negotiable.
        When ai_video lands, bump these quotas back and drop `ai_video` from
        `coming_soon`.
        """
        from app.modules.billing.service import DEFAULT_PLANS
        for plan in DEFAULT_PLANS:
            assert plan["limits"]["videos"] == 0, (
                f"{plan['code']} promises {plan['limits']['videos']} videos "
                "but video generation is feature-flagged off"
            )

    def test_ai_video_not_in_active_features(self):
        """ai_video must be in coming_soon, NOT in features, for every tier."""
        from app.modules.billing.service import DEFAULT_PLANS
        for plan in DEFAULT_PLANS:
            assert "ai_video" not in plan["features"], (
                f"{plan['code']} lists ai_video as an ACTIVE feature — "
                "it's disabled, move it to coming_soon"
            )

    def test_pro_and_agency_list_ai_video_as_coming_soon(self):
        """The tiers that USED to include ai_video must now signal "coming soon"
        instead of silently dropping it (avoids confusing existing customers)."""
        from app.modules.billing.service import DEFAULT_PLANS
        tiers_by_code = {p["code"]: p for p in DEFAULT_PLANS}
        for code in ("pro", "agency"):
            assert "ai_video" in tiers_by_code[code]["coming_soon"], (
                f"{code} should list ai_video in coming_soon"
            )

    def test_free_and_starter_have_no_coming_soon(self):
        """Free and Starter never promised ai_video, so nothing to defer."""
        from app.modules.billing.service import DEFAULT_PLANS
        tiers_by_code = {p["code"]: p for p in DEFAULT_PLANS}
        for code in ("free", "starter"):
            assert tiers_by_code[code]["coming_soon"] == [], (
                f"{code} has coming_soon={tiers_by_code[code]['coming_soon']!r}"
            )

    def test_coming_soon_is_returned_via_api_shape(self):
        """The plan-item serializer must expose coming_soon so the frontend
        can render the badge."""
        from app.db.models import Plan
        from app.modules.billing.service import _row_to_plan_item

        plan = Plan(
            id="00000000-0000-0000-0000-000000000000",
            name="Pro",
            slug="pro",
            price_monthly=99,
            features={
                "code": "pro",
                "features": ["basic_content"],
                "coming_soon": ["ai_video"],
                "limits": {"articles": 150, "videos": 0},
            },
            is_active=True,
        )
        item = _row_to_plan_item(plan)
        assert item["coming_soon"] == ["ai_video"]
        assert "ai_video" not in item["features"]
