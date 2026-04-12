"""Business-profile readiness validator for marketing plan generation."""
from __future__ import annotations

from typing import Any

REQUIRED_FIELDS = [
    {"key": "industry", "label_en": "Industry / Business type", "label_ar": "الصناعة / نوع النشاط"},
    {"key": "description", "label_en": "Business description", "label_ar": "وصف النشاط"},
    {"key": "target_audience", "label_en": "Target audience", "label_ar": "الجمهور المستهدف"},
    {"key": "products", "label_en": "Products or services", "label_ar": "المنتجات أو الخدمات"},
    {"key": "country", "label_en": "Country / market", "label_ar": "البلد / السوق"},
    {"key": "primary_language", "label_en": "Primary language", "label_ar": "اللغة الأساسية"},
]

OPTIONAL_FIELDS = [
    {"key": "competitors", "label_en": "Competitors (optional but improves quality)", "label_ar": "المنافسون (اختياري لكن يحسّن الجودة)"},
    {"key": "brand_voice", "label_en": "Brand voice (tone, forbidden words)", "label_ar": "هوية العلامة (النبرة، الكلمات المحظورة)"},
    {"key": "budget_monthly_usd", "label_en": "Monthly marketing budget (USD)", "label_ar": "ميزانية التسويق الشهرية (دولار)"},
    {"key": "goals", "label_en": "Specific goals (e.g., leads per month, revenue target)", "label_ar": "أهداف محددة (عدد عملاء شهرياً، هدف المبيعات)"},
]


def _empty(v: Any) -> bool:
    if v is None:
        return True
    if isinstance(v, (str, list, dict)) and not v:
        return True
    return False


def validate_business_profile(profile: dict[str, Any]) -> dict:
    """Return {ok, missing, warnings} for a business profile dict.

    Accepts any of these shapes:
      - flat bp dict: {industry, description, ...}
      - wrapper with business_profile key: {business_profile: {...}, ...}
      - _build_business_profile output: {name, config: {business_profile: {...}, ...}, ...}
    """
    if not isinstance(profile, dict):
        profile = {}

    # Collect candidate dicts to search in priority order.
    candidates: list[dict] = [profile]
    bp = profile.get("business_profile")
    if isinstance(bp, dict):
        candidates.append(bp)
    cfg = profile.get("config")
    if isinstance(cfg, dict):
        candidates.append(cfg)
        cfg_bp = cfg.get("business_profile")
        if isinstance(cfg_bp, dict):
            candidates.append(cfg_bp)
        # onboarding nested payload
        ob = cfg.get("onboarding")
        if isinstance(ob, dict):
            ob_bp = ob.get("business_profile")
            if isinstance(ob_bp, dict):
                candidates.append(ob_bp)

    def _get(key: str) -> Any:
        for c in candidates:
            if key in c and not _empty(c.get(key)):
                return c.get(key)
        return None

    missing = []
    warnings = []
    for f in REQUIRED_FIELDS:
        if _empty(_get(f["key"])):
            missing.append({**f, "severity": "required"})
    for f in OPTIONAL_FIELDS:
        if _empty(_get(f["key"])):
            warnings.append({**f, "severity": "recommended"})
    return {"ok": len(missing) == 0, "missing": missing, "warnings": warnings}
