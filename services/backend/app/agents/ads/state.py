"""Shared state schema for AdsAgent graph."""
from __future__ import annotations

from typing import Any, TypedDict


class AdsState(TypedDict, total=False):
    # Inputs
    tenant_id: str
    objective: str                    # awareness | traffic | conversions | sales
    budget_usd: float                 # total budget
    duration_days: int
    target_audience: dict[str, Any]   # personas / free-form spec
    products: list[dict[str, Any]]
    creative_urls: list[str]
    ad_account_id: str                # Meta ad account external id (act_...)
    page_id: str                      # FB page for creatives
    language: str                     # "ar" | "en" | "both"

    # Outputs / intermediate
    targeting_spec: dict[str, Any]
    proposed_campaigns: list[dict[str, Any]]
    proposed_adsets: list[dict[str, Any]]
    proposed_creatives: list[dict[str, Any]]
    optimization_notes: list[str]
    reasoning: str
