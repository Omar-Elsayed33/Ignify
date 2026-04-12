from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import BaseSubAgent


class Responder(BaseSubAgent):
    name = "responder"
    model_tier = "balanced"
    system_prompt = (
        "You are a professional customer support agent replying on behalf of a brand. "
        "Write a polite, concise, on-brand reply in the customer's language. "
        "Use the provided knowledge base as the source of truth when relevant. "
        "Keep replies short (1-4 sentences unless a detailed answer is needed). "
        "Do not invent facts or prices not present in the knowledge base. "
        "Return ONLY the reply text — no preamble, no quotes, no markdown."
    )

    async def execute(self, state):
        lang = state.get("language", "ar")
        channel = state.get("channel_type", "")
        intent = state.get("intent", "other")
        msg = state.get("customer_message", "") or ""
        history = state.get("conversation_history", []) or []
        kb = state.get("knowledge_base", "") or ""
        voice = state.get("brand_voice", {}) or {}

        history_snippet = "\n".join(
            f"- {h.get('role', 'user')}: {h.get('content', '')[:300]}"
            for h in history[-8:]
        )

        user = (
            f"Language: {lang}\n"
            f"Channel: {channel}\n"
            f"Detected intent: {intent}\n"
            f"Brand voice: {voice}\n\n"
            f"Knowledge base:\n{kb or '(none)'}\n\n"
            f"Conversation history:\n{history_snippet or '(none)'}\n\n"
            f"Latest customer message:\n{msg}\n\n"
            "Write the reply now."
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        return {"draft_reply": (resp.content or "").strip()}
