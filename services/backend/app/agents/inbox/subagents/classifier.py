from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import parse_json_response


VALID_INTENTS = {
    "greeting",
    "question",
    "complaint",
    "purchase_intent",
    "booking",
    "feedback",
    "spam",
    "other",
}


class Classifier(BaseSubAgent):
    name = "classifier"
    model_tier = "fast"
    system_prompt = (
        "You are an inbound message classifier for a business inbox. "
        "Classify the customer's message into exactly one intent from: "
        "greeting, question, complaint, purchase_intent, booking, feedback, spam, other. "
        "Also estimate confidence (0.0-1.0) and whether a human agent should handle it. "
        "Flag needs_human=true for complaints, sensitive issues, or when confidence is low (<0.5). "
        "Return STRICT JSON only with keys: intent, confidence, needs_human."
    )

    async def execute(self, state):
        msg = state.get("customer_message", "") or ""
        lang = state.get("language", "ar")
        channel = state.get("channel_type", "")
        history = state.get("conversation_history", []) or []
        history_snippet = "\n".join(
            f"- {h.get('role', 'user')}: {h.get('content', '')[:200]}"
            for h in history[-5:]
        )
        user = (
            f"Language: {lang}\n"
            f"Channel: {channel}\n"
            f"Recent history:\n{history_snippet or '(none)'}\n\n"
            f"Customer message:\n{msg}\n\n"
            "Return the JSON."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        data = parse_json_response(
            resp.content,
            fallback={"intent": "other", "confidence": 0.3, "needs_human": True},
        )
        intent = str(data.get("intent", "other")).lower().strip()
        if intent not in VALID_INTENTS:
            intent = "other"
        try:
            confidence = float(data.get("confidence", 0.5))
        except (TypeError, ValueError):
            confidence = 0.5
        confidence = max(0.0, min(1.0, confidence))
        needs_human = bool(data.get("needs_human", False))
        if intent == "complaint" or confidence < 0.5:
            needs_human = True
        return {
            "intent": intent,
            "confidence": confidence,
            "needs_human": needs_human,
        }
