from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import (
    parse_json_response,
    lang_directive,
    budget_context,
    constraint_directive,
)


class RetentionStrategy(BaseSubAgent):
    name = "retention_strategy"
    model_tier = "balanced"
    system_prompt = (
        "Design retention + upsell strategy.\n"
        "Return STRICT JSON: {first_30_days_program (how to wow new customers), "
        "repeat_purchase_triggers[{trigger,mechanism}], upsell_ladder[{from,to,when}], "
        "churn_prevention[], loyalty_mechanism ('points'|'VIP tier'|'exclusive access'), "
        "reactivation_campaign (what to do when a customer goes silent)}.\n"
        "Tie to the real product catalog and persona frequency.\n"
        "\nALSO include lifecycle_stages and reactivation_triggers:\n"
        "- `lifecycle_stages`: [\n"
        "    {stage: 'new_customer_day_0_7', goal: 'activation', touchpoints: [...], success_metric: 'first_action_completed'},\n"
        "    {stage: 'onboarding_day_8_30', goal: 'habit_formation', touchpoints: [...], success_metric: '3rd_usage'},\n"
        "    {stage: 'mature_month_2_6', goal: 'retention', touchpoints: [...]},\n"
        "    {stage: 'at_risk', goal: 'prevention', trigger: 'no usage for 14 days', action: [...]},\n"
        "    {stage: 'churned', goal: 'win_back', trigger: 'no purchase 60 days', action: [...]}]\n"
        "- `reactivation_triggers`: [\n"
        "    {trigger: 'dormant 30 days', channel: 'whatsapp', offer: '15% discount'},\n"
        "    {trigger: 'dormant 60 days', channel: 'email', offer: 'personal call'},\n"
        "    {trigger: 'dormant 90 days', channel: 'sms', offer: 'anniversary gift'}]"
    )

    async def execute(self, state):
        bp = state.get("business_profile", {})
        lang = state.get("language", "ar")
        personas = state.get("personas", [])
        offer = state.get("offer", {})
        user = (
            lang_directive(lang) + "\n\n"
            + constraint_directive() + "\n\n"
            f"{budget_context(state)}\n\n"
            f"Business: {bp}\nPersonas: {personas}\nOffer: {offer}\n\n"
            "Return retention strategy JSON."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        data = parse_json_response(resp.content, fallback={})
        if not isinstance(data, dict):
            data = {}
        return {"retention": data}
