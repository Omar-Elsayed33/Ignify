from __future__ import annotations

from app.agents.base import BaseSubAgent


HANDOFF_MESSAGES = {
    "ar": "شكرًا لتواصلك معنا. سأقوم بتحويلك إلى أحد المختصين لدينا للمساعدة بشكل أفضل.",
    "en": "Thanks for reaching out. Let me connect you with a specialist who can help you better.",
}


class Escalator(BaseSubAgent):
    name = "escalator"
    model_tier = "fast"
    system_prompt = ""

    async def execute(self, state):
        lang = (state.get("language") or "ar").lower()
        handoff = HANDOFF_MESSAGES.get(lang, HANDOFF_MESSAGES["en"])
        existing_meta = state.get("meta", {}) or {}
        return {
            "draft_reply": handoff,
            "needs_human": True,
            "meta": {
                **existing_meta,
                "escalated": True,
                "escalation_reason": (
                    "complaint_or_low_confidence"
                    if state.get("intent") != "spam"
                    else "spam"
                ),
            },
        }
