"""LeadQualifier — scores a lead and proposes the next action."""
from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import parse_json_response


VALID_QUALIFICATIONS = {"hot", "warm", "cold"}


class LeadQualifier(BaseSubAgent):
    name = "lead_qualifier"
    model_tier = "fast"
    system_prompt = (
        "You are a B2C/B2B lead qualification assistant for a marketing CRM. "
        "Given a lead's contact info, source, status, and recent conversation/activity "
        "history, output a strict JSON with: "
        "{\"score\": <0-100 integer>, \"qualification\": \"hot\"|\"warm\"|\"cold\", "
        "\"next_action\": \"<one concise next step in the lead's language>\"}. "
        "Scoring guide: 80-100 hot (strong purchase intent, specific product questions, "
        "budget/timing hints), 50-79 warm (engaged, asking general questions), "
        "0-49 cold (no clear intent, vague, unresponsive). Respond in JSON ONLY."
    )

    async def execute(self, state):
        lead = state.get("lead") or {}
        name = lead.get("name") or "(unknown)"
        phone = lead.get("phone") or "-"
        email = lead.get("email") or "-"
        notes = lead.get("notes") or "-"
        source = lead.get("source") or "manual"
        status = lead.get("status") or "new"
        history = lead.get("history") or []
        history_text = "\n".join(
            f"- [{h.get('type', 'note')}] {h.get('content', '')[:300]}"
            for h in history[:10]
        )

        user = (
            f"Lead: {name}\n"
            f"Phone: {phone}\n"
            f"Email: {email}\n"
            f"Source: {source}\n"
            f"Current stage: {status}\n"
            f"Notes: {notes}\n"
            f"Recent activity:\n{history_text or '(none)'}\n\n"
            "Return the JSON."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        data = parse_json_response(
            resp.content,
            fallback={"score": 30, "qualification": "cold", "next_action": "Follow up via message"},
        )
        try:
            score = int(data.get("score", 30))
        except (TypeError, ValueError):
            score = 30
        score = max(0, min(100, score))

        qualification = str(data.get("qualification", "cold")).lower().strip()
        if qualification not in VALID_QUALIFICATIONS:
            qualification = "cold" if score < 50 else ("hot" if score >= 80 else "warm")

        next_action = str(data.get("next_action") or "").strip() or "Follow up"

        return {
            "score": score,
            "qualification": qualification,
            "next_action": next_action,
        }
