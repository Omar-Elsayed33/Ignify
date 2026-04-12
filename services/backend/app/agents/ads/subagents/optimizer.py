"""Optimizer — reviews past AdPerformance and suggests adjustments."""
from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy import select

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import parse_json_response
from app.db.database import async_session
from app.db.models import AdCampaign, AdPerformance


class Optimizer(BaseSubAgent):
    name = "ads_optimizer"
    model_tier = "smart"
    system_prompt = (
        "You are a senior performance-marketing optimizer. Given the tenant's recent "
        "Meta Ads performance history and the newly proposed campaigns, return a list "
        "of short actionable recommendations (budget shifts, audience tweaks, creative "
        "swaps) plus a 1-paragraph reasoning summary. "
        "Return STRICT JSON: {\"notes\": [\"...\", \"...\"], \"reasoning\": \"...\"}."
    )

    async def execute(self, state):
        tenant_id = state.get("tenant_id")
        recent: list[dict] = []
        try:
            import uuid as _uuid

            async with async_session() as db:
                rows = await db.execute(
                    select(AdCampaign).where(AdCampaign.tenant_id == _uuid.UUID(str(tenant_id)))
                )
                campaigns = rows.scalars().all()
                for c in campaigns[:20]:
                    perf_rows = await db.execute(
                        select(AdPerformance)
                        .where(AdPerformance.ad_campaign_id == c.id)
                        .order_by(AdPerformance.date.desc())
                        .limit(7)
                    )
                    for p in perf_rows.scalars().all():
                        recent.append(
                            {
                                "campaign": c.name,
                                "date": str(p.date),
                                "impressions": p.impressions,
                                "clicks": p.clicks,
                                "spend": float(p.spend or 0),
                                "ctr": p.ctr,
                                "cpc": p.cpc,
                                "roas": p.roas,
                            }
                        )
        except Exception:  # noqa: BLE001
            recent = []

        proposed = state.get("proposed_campaigns") or []
        user = (
            f"Recent performance (last 7 rows per campaign, capped):\n{recent[:40]}\n\n"
            f"Newly proposed campaigns:\n{proposed}\n\n"
            "Return the JSON now."
        )
        resp = await self.llm.ainvoke(
            [SystemMessage(content=self.system_prompt), HumanMessage(content=user)]
        )
        fallback = {
            "notes": [
                "No prior performance data — start with small daily budgets and scale winners after 3 days.",
                "Keep ads paused until creatives are reviewed.",
            ],
            "reasoning": "Cold-start recommendation since no historical data was available.",
        }
        data = parse_json_response(resp.content, fallback=fallback)
        if not isinstance(data, dict):
            data = fallback
        notes = data.get("notes") or fallback["notes"]
        reasoning = data.get("reasoning") or fallback["reasoning"]
        return {"optimization_notes": list(notes), "reasoning": str(reasoning)}
