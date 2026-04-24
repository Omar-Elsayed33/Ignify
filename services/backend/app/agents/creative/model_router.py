"""Creative-model routing: plan tier → image-gen model + cost estimate.

Why this module exists
----------------------
Flux-Schnell (~$0.003/image) is great for Starter tenants; Agency-tier
customers paying $299/mo expect higher-fidelity output (Flux Dev, Flux Pro,
SD3, etc. — trade 10-30× cost for noticeably better adherence + detail).

Before Phase 8, every tenant hit Flux-Schnell regardless of tier. Now:
- Free / Starter → Flux-Schnell
- Growth        → Flux-Dev (middle quality, mid-cost)
- Pro / Agency  → Flux 1.1 Pro (premium)

Routing is DERIVED — we never let the user pick a model name. The backend
picks based on their plan, so:
(a) users aren't confused by model names they don't understand,
(b) the cost model stays predictable,
(c) we can swap providers without any frontend change.

Cost estimates are upper bounds sourced from Replicate's current
price-per-prediction pages. They drive the `ai_budget.check()` pre-flight
gate; actual cost is recorded post-execution.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

# Plan slugs are canonical strings from billing.DEFAULT_PLANS.
_PlanTier = Literal["free", "starter", "growth", "pro", "agency"]


@dataclass(frozen=True)
class CreativeModelSpec:
    """A single image-generation model bound to a quality tier.

    Fields used by the generator + cost gate:
      - replicate_slug:  the "owner/model" to POST to Replicate's API
      - estimated_cost_usd:  conservative upper-bound per image
      - quality_label:  user-safe name shown in admin logs only
      - default_outputs:  how many variations to produce in one run
    """
    replicate_slug: str
    estimated_cost_usd: float
    quality_label: str
    default_outputs: int

    @property
    def estimated_cost_for_outputs(self) -> float:
        """Budget to reserve for this run — cost × output count."""
        return self.estimated_cost_usd * self.default_outputs


# Model catalog. Prices verified against Replicate public pricing, 2026-04.
# Bumping a model here changes both the selection AND the cost estimate —
# single source of truth.
_CATALOG: dict[str, CreativeModelSpec] = {
    "flux-schnell": CreativeModelSpec(
        replicate_slug="black-forest-labs/flux-schnell",
        estimated_cost_usd=0.003,
        quality_label="Standard",
        default_outputs=4,
    ),
    "flux-dev": CreativeModelSpec(
        replicate_slug="black-forest-labs/flux-dev",
        estimated_cost_usd=0.025,
        quality_label="High",
        default_outputs=2,  # each image costs 8× schnell, halve the count
    ),
    "flux-pro": CreativeModelSpec(
        # flux-1.1-pro: ~$0.04 per image per Replicate pricing.
        replicate_slug="black-forest-labs/flux-1.1-pro",
        estimated_cost_usd=0.04,
        quality_label="Premium",
        default_outputs=2,
    ),
}


# Tier → model key mapping. See module docstring for rationale.
_TIER_TO_MODEL: dict[_PlanTier, str] = {
    "free": "flux-schnell",
    "starter": "flux-schnell",
    "growth": "flux-dev",
    "pro": "flux-pro",
    "agency": "flux-pro",
}


def select_model(plan_slug: str | None) -> CreativeModelSpec:
    """Return the CreativeModelSpec for the given plan slug.

    Falls back to the Starter/Free model (flux-schnell) for unknown slugs
    or missing plans — the cheapest, safest default.
    """
    slug = (plan_slug or "").lower()
    model_key = _TIER_TO_MODEL.get(slug, "flux-schnell")  # type: ignore[arg-type]
    return _CATALOG[model_key]


def estimate_image_cost(plan_slug: str | None, num_images: int | None = None) -> float:
    """Upper-bound budget estimate for an image-gen run on the given plan.

    If `num_images` is None, uses the model's `default_outputs`. Used by the
    `ai_budget.check()` gate to reject unaffordable requests BEFORE the
    Replicate call fires.
    """
    spec = select_model(plan_slug)
    n = num_images if num_images is not None else spec.default_outputs
    return spec.estimated_cost_usd * max(1, n)


def record_actual_cost(spec: CreativeModelSpec, num_images_produced: int) -> float:
    """Compute the actual cost after a successful run.

    We don't hit Replicate's billing API — we trust the catalog price and
    multiply by the number of images actually produced (which may be less
    than requested if the model failed some outputs).
    """
    return spec.estimated_cost_usd * max(0, num_images_produced)


def model_catalog_snapshot() -> dict[str, dict]:
    """Admin-readable catalog dump. Used by /admin endpoints + tests.

    Never exposed to end users — plan-bound routing is supposed to be
    invisible to the customer.
    """
    return {
        key: {
            "replicate_slug": spec.replicate_slug,
            "estimated_cost_usd": spec.estimated_cost_usd,
            "quality_label": spec.quality_label,
            "default_outputs": spec.default_outputs,
        }
        for key, spec in _CATALOG.items()
    }
