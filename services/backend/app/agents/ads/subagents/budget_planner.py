"""BudgetPlanner — splits total budget across 2–3 campaigns based on objective."""
from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import parse_json_response


# Meta objective enum values (v19)
OBJECTIVE_MAP = {
    "awareness": "OUTCOME_AWARENESS",
    "traffic": "OUTCOME_TRAFFIC",
    "engagement": "OUTCOME_ENGAGEMENT",
    "leads": "OUTCOME_LEADS",
    "sales": "OUTCOME_SALES",
    "conversions": "OUTCOME_SALES",
    "app": "OUTCOME_APP_PROMOTION",
}


class BudgetPlanner(BaseSubAgent):
    name = "budget_planner"
    model_tier = "balanced"
    system_prompt = (
        "You are a performance-marketing strategist. Given a total USD budget, duration, "
        "objective, and a single targeting spec, propose 2–3 Meta campaigns that split "
        "the budget wisely (e.g., a top-of-funnel awareness push plus a retargeting / "
        "conversion push). Return STRICT JSON list only — each item:\n"
        '{"name": "...", "objective": "OUTCOME_TRAFFIC", "daily_budget_usd": 25.0, '
        '"share": 0.6, "rationale": "..."}.\n'
        "Sum of `share` must equal 1.0. `daily_budget_usd` = (total_budget * share) / duration_days."
    )

    async def execute(self, state):
        objective = (state.get("objective") or "traffic").lower()
        budget_usd = float(state.get("budget_usd") or 100)
        duration_days = max(int(state.get("duration_days") or 7), 1)
        targeting = state.get("targeting_spec") or {}
        mapped = OBJECTIVE_MAP.get(objective, "OUTCOME_TRAFFIC")

        user = (
            f"Total budget USD: {budget_usd}\n"
            f"Duration days: {duration_days}\n"
            f"Primary objective: {objective} (Meta: {mapped})\n"
            f"Targeting: {targeting}\n\n"
            "Return the JSON list now."
        )
        resp = await self.llm.ainvoke(
            [SystemMessage(content=self.system_prompt), HumanMessage(content=user)]
        )
        default_daily = budget_usd / duration_days
        fallback = [
            {
                "name": "Awareness Push",
                "objective": mapped,
                "daily_budget_usd": round(default_daily * 0.6, 2),
                "share": 0.6,
                "rationale": "Default broad reach split.",
            },
            {
                "name": "Conversion Retarget",
                "objective": "OUTCOME_SALES",
                "daily_budget_usd": round(default_daily * 0.4, 2),
                "share": 0.4,
                "rationale": "Default retargeting split.",
            },
        ]
        campaigns = parse_json_response(resp.content, fallback=fallback)
        if not isinstance(campaigns, list) or not campaigns:
            campaigns = fallback

        # Normalize + attach cents + duration
        proposed: list[dict] = []
        for c in campaigns:
            if not isinstance(c, dict):
                continue
            share = float(c.get("share") or 0) or (1.0 / len(campaigns))
            daily = float(c.get("daily_budget_usd") or (budget_usd * share / duration_days))
            proposed.append(
                {
                    "name": str(c.get("name") or "Campaign"),
                    "objective": str(c.get("objective") or mapped),
                    "daily_budget_usd": round(daily, 2),
                    "daily_budget_cents": int(round(daily * 100)),
                    "share": share,
                    "rationale": c.get("rationale") or "",
                    "duration_days": duration_days,
                }
            )
        return {"proposed_campaigns": proposed}
