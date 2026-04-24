from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import (
    parse_json_response,
    lang_directive,
    budget_context,
    constraint_directive,
    realism_directive,
)


class KPISetter(BaseSubAgent):
    name = "kpi_setter"
    model_tier = "balanced"
    system_prompt = (
        "For EACH AARRR funnel stage (Awareness, Acquisition, Conversion, Retention, Referral) "
        "define ONE KPI tied to the budget reality.\n"
        "Return STRICT JSON array. Each KPI MUST have this shape:\n"
        "{\n"
        '  "stage": str,\n'
        '  "metric": str,\n'
        '  "target_range": {"low": number, "mid": number, "high": number},\n'
        '  "unit": str,\n'
        '  "timeframe_days": number,\n'
        '  "measurement_method": str,\n'
        '  "why": str,\n'
        '  "channel": str,\n'
        '  "confidence": "low" | "medium" | "high",\n'
        '  "assumptions": [str, ...],\n'
        '  "source_basis": str   // benchmark you anchored this to\n'
        "}\n"
        "RULES:\n"
        " - If budget is $0, DO NOT set paid-CPM or CAC-from-ads KPIs — use organic reach / "
        "referrals / WA replies.\n"
        " - Targets must be ACHIEVABLE given the budget (use industry CPL benchmarks).\n"
        " - No vanity metrics like 'followers' unless clearly tied to revenue.\n"
        " - NEVER use a single point estimate — always low/mid/high range.\n"
        "\nMANDATORY: regardless of budget, ALL plans MUST include these KPIs in the array:\n"
        " 1. CAC (Customer Acquisition Cost)\n"
        " 2. LTV (Lifetime Value)\n"
        " 3. LTV:CAC ratio — target 3:1 minimum\n"
        " 4. Payback period in months\n"
        " 5. Monthly new leads\n"
        " 6. Lead-to-customer conversion rate\n"
        " 7. Monthly recurring revenue (or monthly revenue)\n"
        " 8. Customer retention rate (month 2)\n"
        "These 8 KPIs are in ADDITION to the per-AARRR-stage KPIs."
    )

    async def execute(self, state):
        bp = state.get("business_profile", {})
        channels = state.get("channels", [])
        period = state.get("period_days", 30)
        lang = state.get("language", "ar")
        funnel = state.get("funnel", {})
        user = (
            lang_directive(lang) + "\n\n"
            + constraint_directive() + "\n\n"
            + realism_directive() + "\n\n"
            f"{budget_context(state)}\n\n"
            f"Period: {period} days\nBusiness: {bp}\nChannels: {channels}\n"
            f"AARRR funnel context: {funnel}\n\n"
            "Return KPIs as JSON array — ONE KPI per AARRR stage."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        kpis = parse_json_response(resp.content, fallback=[])
        if isinstance(kpis, dict):
            kpis = kpis.get("kpis", [])
        goals = [
            f"{k.get('metric')}: {k.get('target')} {k.get('unit', '')}"
            for k in kpis if isinstance(k, dict)
        ]
        return {"kpis": kpis, "goals": goals}
