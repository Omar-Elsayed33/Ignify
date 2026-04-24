"""AI output guardrails: realism enforcement for LLM-generated marketing content.

Why this exists
---------------
LLMs love round, confident numbers. "You'll get 1,000 leads/month" sounds
great but is indistinguishable from fiction — and the moment a real customer
spends a real budget based on it, we own the blame. This module gives us two
things:

1. **Prompt-side**: reusable directive text to paste into system prompts so
   the model is told to return ranges + confidence levels + explicit assumptions
   instead of absolute numbers.

2. **Output-side**: `validate_realism()` scans a generated JSON payload for
   common fiction signals (round numbers, absence of ranges, missing
   assumptions, absolute-promise language) and returns a list of warnings.
   Callers decide whether to block, log, or annotate.

Design notes
------------
- The directives are append-safe: you can inject them in any prompt without
  breaking existing layout.
- The validator is conservative: it flags (and lets the caller decide) rather
  than rewriting output. Hallucination-style fixes need human review, not
  string-replace magic.
- No LLM call in validation — pure pattern matching. Runs in < 1ms on a
  typical plan payload.
"""
from __future__ import annotations

import re
from typing import Any


# ── Prompt-side directives ────────────────────────────────────────────────────

REALISM_DIRECTIVE = """
⚠️ REALISM RULES — the output is worthless if it's fiction:

1. NUMBERS AS RANGES, NOT POINTS.
   ❌ "expected_leads": 1000
   ✅ "expected_leads_range": {"low": 80, "mid": 120, "high": 180}
   Rationale: real marketing has 2–3× variance between good and bad execution.

2. EVERY NUMERIC ESTIMATE MUST DECLARE ITS CONFIDENCE.
   Add `confidence: "low" | "medium" | "high"`:
     - high:   backed by 3+ similar cases in the stated country+industry+budget
     - medium: directionally correct; variance is 2×
     - low:    plausible but not validated; variance can be 5×
   Default when unsure: "low".

3. EVERY ESTIMATE MUST DECLARE ITS ASSUMPTIONS.
   Add `assumptions: [...]` listing what must be true for the number to hold.
   Example: ["Page gets 2k visits/month via organic + paid combined",
             "CTR to WhatsApp landing is 4-6%",
             "Sales rep responds within 15 min"]
   A number without assumptions is a guess pretending to be a forecast.

4. BENCHMARKS MUST CITE A SOURCE BASIS.
   When you use a CAC/CPL/conversion rate, say where it's anchored:
     "source_basis": "MENA SMB e-commerce CAC typically $80-$180"
   This keeps the model honest and lets the user sanity-check.

5. BUDGET-PROPORTIONAL CEILINGS.
   You cannot acquire more customers than the budget × reasonable efficiency
   allows. Cap: monthly_leads_high ≤ (budget_usd / min_cpl_for_stack).
   If this cap looks too low, say so explicitly — don't inflate the number.
"""


GUARDRAILS_DIRECTIVE = """
⚠️ FORBIDDEN CLAIMS — never output any of these:

1. "Guaranteed" / "مضمون" / "ensured" — no marketing outcome is guaranteed.
2. "Will get X customers" — replace with "Expected range: X-Y customers if…".
3. ROI percentages without timeframe AND assumptions.
4. "Go viral", "10x growth", "instant results", "overnight".
5. "Best in class", "industry-leading", "unbeatable" — no vendor comparisons
   without evidence.
6. Any number implying certainty ("exactly", "always", "every customer").
7. Guarantees of ranking, placement, or algorithm behavior ("rank #1 in 30 days").

When describing outcomes, prefer:
- "expected range based on historical benchmarks"
- "typical performance for this stack is…"
- "conservative / expected / aggressive scenarios"
- "contingent on execution quality"
"""


CONTEXT_ANCHORING_DIRECTIVE = """
⚠️ ANCHOR TO CONTEXT, NOT TO MEDIAN.

Whenever you estimate numbers, ground them in:
- COUNTRY: MENA SMB economics ≠ US SaaS benchmarks. Egypt CPL ≠ UAE CPL.
  Typical ranges (MENA, 2026):
    - Egypt (EGP market):  Meta CPL $1-$6, Google CPL $2-$8
    - Saudi/UAE (premium): Meta CPL $3-$12, Google CPL $5-$20
    - MENA-wide:           organic reach 3-8% on IG/FB, 1-3% on X
- INDUSTRY vertical:
    - e-commerce:   AOV $20-$200, margin 15-40%, CAC ≤ 20% of LTV
    - B2B services: deal size $500-$5000, cycle 30-90 days
    - restaurants:  check size $5-$30, repeat rate 30-50% (month 2)
    - clinics/wellness: LTV $300-$2000, word-of-mouth 30-50% of new leads
- BUDGET:
    - < $200/mo:  organic-only stack; paid ads won't buy meaningful data
    - $200-$1000: 1-2 paid channels, WA-centric funnel
    - $1000-$5000: 2-3 channels, ability to run A/B tests
    - $5000+:     multi-channel + retargeting + creative refresh

If your estimate doesn't match these anchors, the anchor wins — trust the data.
"""


def realism_block() -> str:
    """Full realism + guardrails directive to append to any prompt."""
    return REALISM_DIRECTIVE + "\n" + GUARDRAILS_DIRECTIVE + "\n" + CONTEXT_ANCHORING_DIRECTIVE


# ── Output-side validator ─────────────────────────────────────────────────────

# Phrases in marketing copy that indicate over-promise.
_FORBIDDEN_PATTERNS = [
    re.compile(r"\bguarantee(d|s)?\b", re.IGNORECASE),
    re.compile(r"\bمضمون(ة|ات)?\b"),
    re.compile(r"\bgo\s+viral\b", re.IGNORECASE),
    re.compile(r"\binstant\s+results?\b", re.IGNORECASE),
    re.compile(r"\bovernight\s+(success|growth|results?)\b", re.IGNORECASE),
    re.compile(r"\b10x\s+(growth|leads|revenue|customers)\b", re.IGNORECASE),
    re.compile(r"\brank\s+(number|\#)\s*1\b", re.IGNORECASE),
    re.compile(r"\bbest\s+in\s+class\b", re.IGNORECASE),
    re.compile(r"\bindustry[\-\s]leading\b", re.IGNORECASE),
]


# Absolute-claim patterns: numbers with strong commitment language.
_ABSOLUTE_CLAIM = re.compile(
    r"(?:will|يحقق|will\s+get|will\s+generate|expect(?:s)?|you\s+will\s+(?:get|earn|make))\s+"
    r"(?:\$?[\d,]+\s*(?:\+|%)?)\s*(?:lead|sale|customer|dollar|client|visitor)",
    re.IGNORECASE,
)


def _iter_strings(obj: Any, max_depth: int = 8):
    """Yield every string inside a nested JSON structure (limit depth)."""
    if max_depth <= 0:
        return
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from _iter_strings(v, max_depth - 1)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            yield from _iter_strings(v, max_depth - 1)


def _iter_numbers_with_keys(obj: Any, path: str = "", max_depth: int = 8):
    """Yield (dotted_path, number) for every numeric leaf."""
    if max_depth <= 0:
        return
    if isinstance(obj, (int, float)) and not isinstance(obj, bool):
        yield path, obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            nxt = f"{path}.{k}" if path else str(k)
            yield from _iter_numbers_with_keys(v, nxt, max_depth - 1)
    elif isinstance(obj, (list, tuple)):
        for i, v in enumerate(obj):
            nxt = f"{path}[{i}]"
            yield from _iter_numbers_with_keys(v, nxt, max_depth - 1)


def validate_realism(payload: Any) -> list[dict]:
    """Scan an AI-generated payload for realism-violation signals.

    Returns a list of `{severity, kind, where, message}` warnings. Empty list
    means the payload passed. Severities:
      - `error`:   forbidden claim language — should be rejected/regenerated
      - `warning`: suspicious pattern — log and show to reviewer
      - `info`:    style nit — optional cleanup

    Kinds:
      - `forbidden_claim`      : matched a banned phrase ("guaranteed", etc.)
      - `absolute_point_claim` : "will get 1000 leads" without a range
      - `round_number_suspicious`: leads/customer counts that are exact
        powers of 10 (100, 1000, 10000) — almost always fictional
      - `no_confidence_marker` : metric block has a target but no `confidence`
      - `no_assumptions`       : metric block has a target but no `assumptions`
    """
    warnings: list[dict] = []

    # Text-level checks.
    for text in _iter_strings(payload):
        for pat in _FORBIDDEN_PATTERNS:
            m = pat.search(text)
            if m:
                warnings.append({
                    "severity": "error",
                    "kind": "forbidden_claim",
                    "where": "text",
                    "message": f"forbidden phrase {m.group(0)!r} in output",
                })
        if _ABSOLUTE_CLAIM.search(text):
            warnings.append({
                "severity": "warning",
                "kind": "absolute_point_claim",
                "where": "text",
                "message": "absolute point-claim detected — should be a range",
            })

    # Number-level checks on numeric leaves.
    for path, n in _iter_numbers_with_keys(payload):
        # Only flag count-like keys (leads, customers, etc.) that are exact
        # powers of 10 — price-like fields (usd/cpl/cac) are legitimately round.
        low_path = path.lower()
        count_like = any(k in low_path for k in (
            "leads", "customers", "clients", "signups", "conversions",
            "monthly_new", "total_sales", "reach"
        ))
        price_like = any(k in low_path for k in (
            "usd", "cpl", "cac", "ltv", "revenue", "budget", "price", "cost",
        ))
        if (
            count_like
            and not price_like
            and n >= 100
            and n == round(n)
            and n % (10 ** (len(str(int(n))) - 1)) == 0  # 100, 1000, 10000, etc.
        ):
            warnings.append({
                "severity": "warning",
                "kind": "round_number_suspicious",
                "where": path,
                "message": f"round-number estimate {n} looks fabricated; prefer a range",
            })

    # Structural checks on known KPI/channel blocks.
    # Top-level `kpis`: each item should declare confidence + assumptions.
    if isinstance(payload, dict):
        kpis = payload.get("kpis")
        if isinstance(kpis, list):
            for i, kpi in enumerate(kpis):
                if not isinstance(kpi, dict):
                    continue
                if "target" in kpi and "confidence" not in kpi:
                    warnings.append({
                        "severity": "info",
                        "kind": "no_confidence_marker",
                        "where": f"kpis[{i}].{kpi.get('metric', '?')}",
                        "message": "KPI target lacks `confidence`",
                    })
                if "target" in kpi and not kpi.get("assumptions"):
                    warnings.append({
                        "severity": "info",
                        "kind": "no_assumptions",
                        "where": f"kpis[{i}].{kpi.get('metric', '?')}",
                        "message": "KPI target lacks `assumptions`",
                    })

        channels = payload.get("channels")
        if isinstance(channels, list):
            for i, ch in enumerate(channels):
                if not isinstance(ch, dict):
                    continue
                # Channel should have a range for expected leads, not a point.
                if "expected_leads" in ch and "expected_leads_range" not in ch:
                    warnings.append({
                        "severity": "warning",
                        "kind": "absolute_point_claim",
                        "where": f"channels[{i}]",
                        "message": "channel has `expected_leads` but no `expected_leads_range`",
                    })

    return warnings


def has_blocking_issues(warnings: list[dict]) -> bool:
    """Return True if any warning is severity=error — caller should reject output."""
    return any(w.get("severity") == "error" for w in warnings)
