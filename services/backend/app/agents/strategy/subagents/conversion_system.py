from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import (
    parse_json_response,
    lang_directive,
    budget_context,
    constraint_directive,
)


class ConversionSystem(BaseSubAgent):
    name = "conversion_system"
    model_tier = "smart"
    system_prompt = (
        "Design the conversion journey AFTER the click. Produce a STRUCTURED WhatsApp funnel "
        "plus a full sales pipeline with CRM logic.\n"
        "Return STRICT JSON with this exact shape:\n"
        "{\n"
        '  "landing_page_logic": {"hook_above_fold": "...", "sections_below": ["...","...","...","...","..."],\n'
        '    "cta_copy": "...", "proof_elements": ["..."]},\n'
        '  "whatsapp_funnel": {\n'
        '    "qualification_stage": {\n'
        '      "welcome": "...",\n'
        '      "qualifying_questions": [{"q": "...", "purpose": "..."}],\n'
        '      "disqualify_criteria": "what makes a lead NOT a fit",\n'
        '      "branches": [\n'
        '        {"if": "high_intent", "action": "send catalog + book call"},\n'
        '        {"if": "price_objection", "action": "send payment plans + guarantees"},\n'
        '        {"if": "comparison_shopper", "action": "send differentiation 1-pager"},\n'
        '        {"if": "not_ready", "action": "add to nurture list + 7-day follow-up"}\n'
        '      ]\n'
        '    },\n'
        '    "objection_scripts": [\n'
        '      {"objection": "السعر مرتفع", "response": "...", "escalation": "discount/payment plan"}\n'
        '    ],\n'
        '    "closing_paths": [\n'
        '      {"path": "trust_based", "steps": ["send testimonial", "offer guarantee", "ask for order"]},\n'
        '      {"path": "urgency_based", "steps": ["show limited stock", "time-limited offer", "ask for order"]}\n'
        '    ],\n'
        '    "follow_up_cadence": [\n'
        '      {"day": 1, "channel": "whatsapp", "message": "..."},\n'
        '      {"day": 3, "channel": "whatsapp", "message": "..."},\n'
        '      {"day": 7, "channel": "email", "message": "..."}\n'
        '    ]\n'
        '  },\n'
        '  "sales_pipeline": {\n'
        '    "stages": [\n'
        '      {"name": "قاد جديد", "sla_hours": 1, "conversion_rate_pct": 80, "owner": "SDR", "action": "first message within 1 hour"},\n'
        '      {"name": "مؤهل", "sla_hours": 24, "conversion_rate_pct": 40, "owner": "SDR", "action": "qualify + book demo"},\n'
        '      {"name": "عرض مقدم", "sla_hours": 72, "conversion_rate_pct": 35, "owner": "AE", "action": "send proposal"},\n'
        '      {"name": "تفاوض", "sla_hours": 168, "conversion_rate_pct": 60, "owner": "AE", "action": "handle objections"},\n'
        '      {"name": "عميل", "sla_hours": 0, "conversion_rate_pct": 100, "owner": "CSM", "action": "onboard"}\n'
        '    ],\n'
        '    "crm_logic": {\n'
        '      "auto_lead_scoring": "rules based on actions (visited pricing = +20, abandoned cart = +30)",\n'
        '      "stage_automation": "auto-move on specific triggers",\n'
        '      "required_fields_per_stage": {"مؤهل": ["phone", "budget_range"], "عرض مقدم": ["timeline"]}\n'
        '    }\n'
        '  },\n'
        '  "abandoned_cart_flow": ["step 1","step 2","step 3"],\n'
        '  "follow_up_sequence": [{"day": 1, "channel": "whatsapp", "message": "..."}]\n'
        "}\n"
        "Write ACTUAL copy (not 'friendly intro'). Reference the offer + objections from personas. "
        "Stage names in Arabic when language=ar."
    )

    async def execute(self, state):
        bp = state.get("business_profile", {})
        lang = state.get("language", "ar")
        offer = state.get("offer", {})
        personas = state.get("personas", [])
        journey = state.get("customer_journey", {})
        user = (
            lang_directive(lang) + "\n\n"
            + constraint_directive() + "\n\n"
            f"{budget_context(state)}\n\n"
            f"Business: {bp}\nOffer: {offer}\nPersonas: {personas}\nJourney: {journey}\n\n"
            "Return the conversion system JSON with real copy, structured WhatsApp funnel, "
            "and full sales pipeline with CRM logic."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        data = parse_json_response(resp.content, fallback={})
        if not isinstance(data, dict):
            data = {}
        return {"conversion": data}
