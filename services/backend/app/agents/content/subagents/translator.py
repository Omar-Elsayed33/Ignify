from __future__ import annotations

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.base import BaseSubAgent


class Translator(BaseSubAgent):
    name = "translator"
    model_tier = "balanced"
    system_prompt = (
        "You are a professional marketing translator between Arabic and English. "
        "Preserve tone, brand voice, emojis, and calls-to-action. "
        "Return ONLY the translated text — no preamble, no quotes."
    )

    async def execute(self, state):
        language = state.get("language", "ar")
        # Prefer the brand-guarded final if present, else fall back to draft
        source = state.get("final") or state.get("draft") or ""

        if language != "both":
            # Pass-through: make sure `final` is set
            return {"final": source}

        if not source.strip():
            return {"final": ""}

        # Heuristic: detect primary language of source
        has_arabic = any("\u0600" <= ch <= "\u06FF" for ch in source)
        target_lang = "English" if has_arabic else "Arabic"
        user = (
            f"Translate the following marketing copy to {target_lang}. "
            "Keep meaning, tone, and any emojis/hashtags intact.\n\n"
            f"{source}"
        )
        resp = await self.llm.ainvoke([
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user),
        ])
        translated = (resp.content or "").strip()

        if has_arabic:
            ar_text, en_text = source, translated
        else:
            ar_text, en_text = translated, source

        combined = f"AR:\n{ar_text}\n\nEN:\n{en_text}"
        return {"final": combined}
