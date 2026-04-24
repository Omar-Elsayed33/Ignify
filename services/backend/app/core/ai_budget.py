"""AI cost control — per-tenant budget enforcement and spend tracking.

Why this exists
---------------
Without a cap, a single tenant on the Pro tier ($99/mo) can run 1,000 Deep plans
in a month at ~$0.59 each = $590 in LLM spend against $99 collected. The
`TenantOpenRouterConfig.monthly_limit_usd` column has existed since Phase 1 but
was never enforced at the execution path. This module fixes that.

Design
------
Three-stage flow for any AI action that calls paid models:

  1. estimate()    — cheap, synchronous upper-bound estimate before invoking
     the model. Used to reject obviously-unaffordable requests.
  2. check()       — loads the tenant's current spend; raises
     `AIBudgetExceeded` if limit already met or this request would exceed it.
  3. record()      — after the action, add the ACTUAL cost to usage_usd.

Plus soft-warning helpers for the UI (80% threshold).

Deep-mode throttle
------------------
Deep plan generation is disproportionately expensive (~50× Fast). A separate
`DEEP_MODE_MONTHLY_CAP` limits how many Deep-mode plans a tenant can run per
calendar month, independent of dollar spend.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AgentRun, TenantOpenRouterConfig

logger = logging.getLogger(__name__)


# ── Public constants ──────────────────────────────────────────────────────────

SOFT_WARNING_THRESHOLD = 0.80  # 80% of monthly_limit_usd triggers a soft warning
DEEP_MODE_MONTHLY_CAP = 10     # per-tenant Deep plan runs per calendar month


# Conservative per-plan cost upper bounds (USD). Used for the cheap estimate()
# call. These are UPPER bounds — actual costs will usually be lower. Numbers
# are derived from docs/model-compare/PLAN_MODE_PRICING.md (expected medians
# × 2 for safety margin).
_PLAN_MODE_ESTIMATES: dict[str, float] = {
    "fast": 0.05,
    "medium": 0.80,
    "deep": 1.50,
}

# Per-feature conservative estimates (one-shot calls, not full 14-node pipelines).
_FEATURE_ESTIMATES: dict[str, float] = {
    "content_gen.generate": 0.05,
    "content_gen.bulk": 0.25,
    "creative_gen.image": 0.02,          # Flux-Schnell on Replicate
    "video_gen.full": 0.40,
    "seo.audit_deep": 0.15,
    "competitor.analyze": 0.08,
    "ai_assistant.chat": 0.05,
    "ai_assistant.analyze_website": 0.10,
}


# ── Public types ──────────────────────────────────────────────────────────────


class AIBudgetExceeded(Exception):
    """Raised when a tenant's monthly AI budget would be exceeded.

    Caller should surface as HTTP 402 Payment Required with `code` + `message`
    so the frontend can render an upgrade CTA, not a generic error.
    """

    def __init__(
        self,
        *,
        tenant_id: uuid.UUID,
        limit_usd: float,
        usage_usd: float,
        estimated_cost_usd: float,
        reason: Literal["limit_reached", "would_exceed", "deep_mode_cap"],
    ) -> None:
        self.tenant_id = tenant_id
        self.limit_usd = limit_usd
        self.usage_usd = usage_usd
        self.estimated_cost_usd = estimated_cost_usd
        self.reason = reason
        super().__init__(
            f"AI budget exceeded for tenant {tenant_id} ({reason}): "
            f"limit=${limit_usd:.2f} usage=${usage_usd:.4f} "
            f"estimated=${estimated_cost_usd:.4f}"
        )


@dataclass
class BudgetStatus:
    """Snapshot used by both the gate and the frontend usage widget."""
    limit_usd: float
    usage_usd: float
    remaining_usd: float
    usage_pct: float
    soft_warning: bool  # true once usage_pct >= 80%
    blocked: bool       # true once remaining <= 0

    def to_dict(self) -> dict:
        return {
            "limit_usd": round(self.limit_usd, 2),
            "usage_usd": round(self.usage_usd, 4),
            "remaining_usd": round(self.remaining_usd, 2),
            "usage_pct": round(self.usage_pct * 100, 1),
            "soft_warning": self.soft_warning,
            "blocked": self.blocked,
        }


# ── Public API ────────────────────────────────────────────────────────────────


def estimate_plan_mode(mode: str) -> float:
    """Upper-bound cost estimate for a plan-generation run in the given mode."""
    return _PLAN_MODE_ESTIMATES.get((mode or "fast").lower(), _PLAN_MODE_ESTIMATES["fast"])


def estimate_feature(feature: str) -> float:
    """Upper-bound cost estimate for a named feature. Unknown → $0.05."""
    return _FEATURE_ESTIMATES.get(feature, 0.05)


async def get_or_init_config(
    db: AsyncSession, tenant_id: uuid.UUID
) -> TenantOpenRouterConfig:
    """Return the tenant's AI budget config, creating it with defaults if missing."""
    result = await db.execute(
        select(TenantOpenRouterConfig).where(
            TenantOpenRouterConfig.tenant_id == tenant_id
        )
    )
    cfg = result.scalar_one_or_none()
    if cfg is None:
        cfg = TenantOpenRouterConfig(tenant_id=tenant_id)  # defaults: limit=2.50, usage=0
        db.add(cfg)
        await db.flush()
    return cfg


async def get_status(db: AsyncSession, tenant_id: uuid.UUID) -> BudgetStatus:
    """Read the tenant's current budget posture — used by /ai-usage/me + gate."""
    cfg = await get_or_init_config(db, tenant_id)
    limit = float(cfg.monthly_limit_usd or 0)
    usage = float(cfg.usage_usd or 0)
    remaining = max(0.0, limit - usage)
    pct = (usage / limit) if limit > 0 else 1.0  # no limit set ⇒ treat as full
    return BudgetStatus(
        limit_usd=limit,
        usage_usd=usage,
        remaining_usd=remaining,
        usage_pct=min(pct, 1.0),
        soft_warning=(pct >= SOFT_WARNING_THRESHOLD),
        blocked=(remaining <= 0),
    )


async def check(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    estimated_cost_usd: float,
    feature: str,
    plan_mode: str | None = None,
) -> BudgetStatus:
    """Gate an AI action. Raises AIBudgetExceeded if the request is unaffordable.

    Semantics:
      - If current usage >= limit: hard block with reason=limit_reached.
      - If current_usage + estimated_cost > limit: block with reason=would_exceed.
      - If plan_mode == "deep" and tenant already ran DEEP_MODE_MONTHLY_CAP
        deep plans this calendar month: block with reason=deep_mode_cap.

    Returns a BudgetStatus snapshot so the caller can pass-through to the
    response and the frontend can render the soft-warning banner.
    """
    status = await get_status(db, tenant_id)

    if status.blocked:
        raise AIBudgetExceeded(
            tenant_id=tenant_id,
            limit_usd=status.limit_usd,
            usage_usd=status.usage_usd,
            estimated_cost_usd=estimated_cost_usd,
            reason="limit_reached",
        )

    if status.usage_usd + estimated_cost_usd > status.limit_usd:
        raise AIBudgetExceeded(
            tenant_id=tenant_id,
            limit_usd=status.limit_usd,
            usage_usd=status.usage_usd,
            estimated_cost_usd=estimated_cost_usd,
            reason="would_exceed",
        )

    # Deep-mode throttle.
    if plan_mode and plan_mode.lower() == "deep":
        deep_count = await _deep_runs_this_month(db, tenant_id)
        if deep_count >= DEEP_MODE_MONTHLY_CAP:
            raise AIBudgetExceeded(
                tenant_id=tenant_id,
                limit_usd=status.limit_usd,
                usage_usd=status.usage_usd,
                estimated_cost_usd=estimated_cost_usd,
                reason="deep_mode_cap",
            )

    return status


async def record(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    actual_cost_usd: float,
    feature: str,
    model: str | None = None,
) -> None:
    """Credit the tenant's usage_usd ledger after an AI action completes.

    Idempotent per-call: each invocation adds the actual cost. Callers should
    NOT double-call — recording is a one-shot at task completion.

    Logs a structured line per call so ops can grep / aggregate spend by
    tenant / feature / model without hitting the DB.
    """
    cfg = await get_or_init_config(db, tenant_id)
    cfg.usage_usd = float(cfg.usage_usd or 0) + max(0.0, actual_cost_usd)
    await db.flush()
    logger.info(
        "ai_spend tenant=%s feature=%s model=%s cost_usd=%.6f new_total=%.6f",
        tenant_id, feature, model or "-", actual_cost_usd, cfg.usage_usd,
    )


# ── Internal ──────────────────────────────────────────────────────────────────


async def _deep_runs_this_month(
    db: AsyncSession, tenant_id: uuid.UUID
) -> int:
    """Count AgentRun rows this calendar month where input.plan_mode == 'deep'.

    AgentRun.input is declared as plain JSON (not JSONB), which lacks the
    SQLAlchemy `.astext` / `->>` accessor. Use a raw `jsonb_extract_path_text`
    cast via text() so we don't depend on column-type changes.
    """
    from sqlalchemy import text as _sql_text

    now = datetime.now(timezone.utc)
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

    result = await db.execute(
        _sql_text(
            """
            SELECT COUNT(*) AS n FROM agent_runs
            WHERE tenant_id = :t
              AND agent_name = 'strategy'
              AND started_at >= :since
              AND jsonb_extract_path_text(input::jsonb, 'plan_mode') = 'deep'
            """
        ),
        {"t": tenant_id, "since": month_start},
    )
    row = result.first()
    return int((row.n if row else 0) or 0)


# ── Aggregation helpers for admin dashboards ─────────────────────────────────


async def tenant_spend_breakdown(
    db: AsyncSession, tenant_id: uuid.UUID, *, days: int = 30
) -> dict:
    """Return per-feature + per-model spend for the last N days.

    Used by the admin panel to answer "where is this tenant's money going?"
    Groups AgentRuns by `agent_name` (proxy for feature) and `model`.
    """
    since = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    since = since.replace(day=1) if days >= 28 else since

    # Per-feature
    feature_rows = (await db.execute(
        select(
            AgentRun.agent_name,
            func.sum(AgentRun.cost_usd).label("total"),
            func.count().label("runs"),
        ).where(
            and_(
                AgentRun.tenant_id == tenant_id,
                AgentRun.started_at >= since,
            )
        ).group_by(AgentRun.agent_name)
    )).all()

    # Per-model
    model_rows = (await db.execute(
        select(
            AgentRun.model,
            func.sum(AgentRun.cost_usd).label("total"),
            func.count().label("runs"),
        ).where(
            and_(
                AgentRun.tenant_id == tenant_id,
                AgentRun.started_at >= since,
                AgentRun.model.is_not(None),
            )
        ).group_by(AgentRun.model)
    )).all()

    return {
        "since": since.isoformat(),
        "by_feature": [
            {"feature": r.agent_name, "cost_usd": float(r.total or 0), "runs": int(r.runs)}
            for r in feature_rows
        ],
        "by_model": [
            {"model": r.model, "cost_usd": float(r.total or 0), "runs": int(r.runs)}
            for r in model_rows
        ],
    }
