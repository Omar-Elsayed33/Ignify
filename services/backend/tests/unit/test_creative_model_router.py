"""Phase 8 P1: creative model router unit tests.

Verifies the contract that the image generator + cost gate rely on:
- Plan tier → deterministic model choice.
- Cost estimates monotonically increase with tier.
- Unknown / missing plan slugs fall back safely to the cheapest model.
- Catalog snapshot returns all the fields admin dashboards need.
"""
from __future__ import annotations

import pytest

from app.agents.creative.model_router import (
    CreativeModelSpec,
    estimate_image_cost,
    model_catalog_snapshot,
    record_actual_cost,
    select_model,
)


pytestmark = pytest.mark.unit


class TestSelectModel:
    @pytest.mark.parametrize("slug,expected_slug", [
        ("free", "black-forest-labs/flux-schnell"),
        ("starter", "black-forest-labs/flux-schnell"),
        ("growth", "black-forest-labs/flux-dev"),
        ("pro", "black-forest-labs/flux-1.1-pro"),
        ("agency", "black-forest-labs/flux-1.1-pro"),
    ])
    def test_tier_routes_to_expected_model(self, slug, expected_slug):
        spec = select_model(slug)
        assert spec.replicate_slug == expected_slug

    def test_unknown_slug_falls_back_to_cheapest(self):
        spec = select_model("nonexistent-tier")
        assert spec.replicate_slug == "black-forest-labs/flux-schnell"

    def test_none_slug_falls_back_to_cheapest(self):
        spec = select_model(None)
        assert spec.replicate_slug == "black-forest-labs/flux-schnell"

    def test_case_insensitive(self):
        assert select_model("PRO").replicate_slug == select_model("pro").replicate_slug

    def test_returns_immutable_spec(self):
        """CreativeModelSpec is frozen — callers can't mutate price accidentally."""
        spec = select_model("free")
        assert isinstance(spec, CreativeModelSpec)
        with pytest.raises(Exception):
            spec.estimated_cost_usd = 999.0  # dataclass(frozen=True) rejects


class TestCostScaling:
    def test_price_increases_with_tier(self):
        costs = [
            select_model("free").estimated_cost_usd,
            select_model("starter").estimated_cost_usd,
            select_model("growth").estimated_cost_usd,
            select_model("pro").estimated_cost_usd,
            select_model("agency").estimated_cost_usd,
        ]
        # Free/Starter same, Growth > both, Pro/Agency highest.
        assert costs[0] == costs[1]  # Free = Starter = schnell
        assert costs[2] > costs[1]   # Growth > Starter
        assert costs[3] > costs[2]   # Pro > Growth
        assert costs[3] == costs[4]  # Pro = Agency

    def test_estimate_scales_with_output_count(self):
        # Explicit count overrides default.
        one = estimate_image_cost("starter", num_images=1)
        four = estimate_image_cost("starter", num_images=4)
        assert four == pytest.approx(one * 4)

    def test_estimate_uses_default_outputs_when_unset(self):
        spec = select_model("starter")
        # Default should match the spec's default_outputs × unit price.
        estimated = estimate_image_cost("starter")
        assert estimated == pytest.approx(spec.estimated_cost_usd * spec.default_outputs)

    def test_record_actual_cost_zero_for_no_images(self):
        spec = select_model("pro")
        assert record_actual_cost(spec, 0) == 0.0

    def test_record_actual_cost_scales(self):
        spec = select_model("pro")
        assert record_actual_cost(spec, 3) == pytest.approx(spec.estimated_cost_usd * 3)

    def test_record_actual_negative_clamps_to_zero(self):
        spec = select_model("pro")
        # Caller should never pass negative, but defense in depth.
        assert record_actual_cost(spec, -5) == 0.0


class TestCatalogSnapshot:
    def test_snapshot_contains_all_tiers(self):
        snap = model_catalog_snapshot()
        assert "flux-schnell" in snap
        assert "flux-dev" in snap
        assert "flux-pro" in snap

    def test_snapshot_shape(self):
        snap = model_catalog_snapshot()
        for key, entry in snap.items():
            assert "replicate_slug" in entry
            assert "estimated_cost_usd" in entry
            assert "quality_label" in entry
            assert "default_outputs" in entry

    def test_default_outputs_inversely_correlated_with_cost(self):
        """Cheaper models give more variations per run — expensive ones give
        fewer. Keeps the budget reservation per-run roughly comparable."""
        snap = model_catalog_snapshot()
        cheap = snap["flux-schnell"]
        expensive = snap["flux-pro"]
        assert cheap["default_outputs"] >= expensive["default_outputs"]
