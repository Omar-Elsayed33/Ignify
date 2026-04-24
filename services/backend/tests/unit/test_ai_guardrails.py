"""Phase 2.5: tests for AI output realism guardrails.

Covers both the prompt-side directive helpers and the post-output validator.
"""
from __future__ import annotations

import pytest

from app.core.ai_guardrails import (
    has_blocking_issues,
    realism_block,
    validate_realism,
)


pytestmark = pytest.mark.unit


class TestRealismBlockContent:
    def test_block_contains_ranges_requirement(self):
        block = realism_block()
        assert "range" in block.lower()
        assert "confidence" in block.lower()
        assert "assumptions" in block.lower()

    def test_block_lists_forbidden_phrases(self):
        block = realism_block()
        assert "guarantee" in block.lower()
        assert "go viral" in block.lower() or "viral" in block.lower()

    def test_block_mentions_anchoring(self):
        block = realism_block()
        # Anchors to country + industry + budget
        assert "country" in block.lower()
        assert "budget" in block.lower()


class TestForbiddenClaims:
    @pytest.mark.parametrize("text", [
        "This plan is guaranteed to generate 1000 leads",
        "You will rank number 1 in 30 days",
        "Best in class marketing solution",
        "industry-leading results",
        "Instant results for your business",
        "overnight success guaranteed",
    ])
    def test_forbidden_phrases_flagged_as_error(self, text):
        warnings = validate_realism({"summary": text})
        assert any(w["severity"] == "error" for w in warnings), \
            f"expected error for {text!r}, got {warnings}"
        assert has_blocking_issues(warnings)

    def test_clean_text_has_no_errors(self):
        warnings = validate_realism({
            "summary": "Expected range: 80-150 leads per month based on benchmark CPL of $3-$8."
        })
        errors = [w for w in warnings if w["severity"] == "error"]
        assert errors == []


class TestRoundNumberDetection:
    def test_round_lead_count_flagged(self):
        # 1000 is exactly a power of 10 — should be flagged.
        warnings = validate_realism({"expected_monthly_leads": 1000})
        assert any(
            w["kind"] == "round_number_suspicious"
            and "expected_monthly_leads" in w["where"]
            for w in warnings
        )

    def test_range_not_flagged(self):
        # A {low, mid, high} range for leads should never trigger round-number.
        # Individual values in the range may happen to be round — that's ok.
        warnings = validate_realism({
            "expected_leads_range": {"low": 80, "mid": 120, "high": 180}
        })
        round_warns = [w for w in warnings if w["kind"] == "round_number_suspicious"]
        assert round_warns == []

    def test_price_fields_not_flagged_as_round(self):
        # CAC/CPL/revenue fields are legitimately round (you quote $100, $500).
        warnings = validate_realism({
            "cac_usd": 100,
            "monthly_budget_usd": 500,
            "ltv_usd": 1000,
        })
        round_warns = [w for w in warnings if w["kind"] == "round_number_suspicious"]
        assert round_warns == []


class TestKPIStructureValidation:
    def test_kpi_without_confidence_flagged_info(self):
        payload = {
            "kpis": [
                {"metric": "CAC", "target": 100, "unit": "USD"},
            ]
        }
        warnings = validate_realism(payload)
        assert any(
            w["kind"] == "no_confidence_marker" and "CAC" in w["where"]
            for w in warnings
        )

    def test_kpi_with_full_structure_passes(self):
        payload = {
            "kpis": [
                {
                    "metric": "CAC",
                    "target_range": {"low": 80, "mid": 120, "high": 180},
                    "unit": "USD",
                    "confidence": "medium",
                    "assumptions": ["Meta CPM in MENA 2026", "10% conversion"],
                },
            ]
        }
        warnings = validate_realism(payload)
        # `target` key isn't present, so no structure warnings fire.
        structure_warns = [
            w for w in warnings if w["kind"] in ("no_confidence_marker", "no_assumptions")
        ]
        assert structure_warns == []

    def test_kpi_without_assumptions_flagged_info(self):
        payload = {
            "kpis": [
                {"metric": "CAC", "target": 120, "confidence": "medium"},
            ]
        }
        warnings = validate_realism(payload)
        assert any(w["kind"] == "no_assumptions" for w in warnings)


class TestChannelsStructureValidation:
    def test_channel_with_point_estimate_flagged(self):
        payload = {
            "channels": [
                {"channel": "Meta Ads", "expected_leads": 200, "expected_cpl_usd": 5},
            ]
        }
        warnings = validate_realism(payload)
        assert any(w["kind"] == "absolute_point_claim" for w in warnings)

    def test_channel_with_range_passes(self):
        payload = {
            "channels": [
                {
                    "channel": "Meta Ads",
                    "expected_leads_range": {"low": 80, "mid": 120, "high": 180},
                    "expected_cpl_range_usd": {"low": 3, "mid": 5, "high": 8},
                    "confidence": "medium",
                },
            ]
        }
        warnings = validate_realism(payload)
        # No absolute-point claims for this channel.
        ac = [w for w in warnings if w["kind"] == "absolute_point_claim"]
        assert ac == []


class TestHasBlockingIssues:
    def test_only_info_warnings_not_blocking(self):
        warnings = [
            {"severity": "info", "kind": "no_confidence_marker", "where": "x", "message": ""},
            {"severity": "warning", "kind": "round_number_suspicious", "where": "x", "message": ""},
        ]
        assert not has_blocking_issues(warnings)

    def test_any_error_is_blocking(self):
        warnings = [
            {"severity": "info", "kind": "x", "where": "x", "message": ""},
            {"severity": "error", "kind": "forbidden_claim", "where": "x", "message": ""},
        ]
        assert has_blocking_issues(warnings)
