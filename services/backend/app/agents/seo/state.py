"""Shared state schema for SEOAgent graph."""
from __future__ import annotations

from typing import Any, TypedDict


class SEOState(TypedDict, total=False):
    tenant_id: str
    url: str
    language: str                       # "ar" | "en"
    target_keywords: list[str]
    competitor_domains: list[str]
    audit_result: dict[str, Any]        # on-page audit raw output
    rankings: list[dict[str, Any]]      # one entry per keyword
    recommendations: list[dict[str, Any]]
    content_suggestions: dict[str, Any]
    linking_strategy: list[dict[str, Any]]
