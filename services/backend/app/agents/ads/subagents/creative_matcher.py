"""CreativeMatcher — pairs each proposed campaign with a creative + ad copy."""
from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import parse_json_response


class CreativeMatcher(BaseSubAgent):
    name = "creative_matcher"
    model_tier = "balanced"
    system_prompt = (
        "You are a senior ad copywriter. For each campaign below, pick the best image "
        "from the supplied creative URL list, and write a short compelling ad message "
        "(1–2 sentences) plus a headline (<=40 chars) and a CTA link destination. "
        "Return STRICT JSON list, one object per campaign, in the same order:\n"
        '{"campaign_name": "...", "image_url": "...", "headline": "...", '
        '"message": "...", "link": "https://..."}\n'
        "If no creative URLs are provided, set image_url to null."
    )

    async def execute(self, state):
        campaigns = state.get("proposed_campaigns") or []
        creatives = state.get("creative_urls") or []
        products = state.get("products") or []
        lang = state.get("language", "en")

        if not campaigns:
            return {"proposed_creatives": []}

        user = (
            f"Language: {lang}\n"
            f"Products: {products}\n"
            f"Creative URLs: {creatives}\n\n"
            f"Campaigns:\n"
            + "\n".join(f"- {c.get('name')}: {c.get('rationale')}" for c in campaigns)
            + "\n\nReturn the JSON list now."
        )
        resp = await self.llm.ainvoke(
            [SystemMessage(content=self.system_prompt), HumanMessage(content=user)]
        )

        default_link = "https://example.com"
        if products and isinstance(products[0], dict):
            default_link = products[0].get("url") or default_link

        fallback = [
            {
                "campaign_name": c.get("name"),
                "image_url": (creatives[i % len(creatives)] if creatives else None),
                "headline": (c.get("name") or "Offer")[:40],
                "message": c.get("rationale") or "Discover our latest offering.",
                "link": default_link,
            }
            for i, c in enumerate(campaigns)
        ]
        parsed = parse_json_response(resp.content, fallback=fallback)
        if not isinstance(parsed, list) or len(parsed) != len(campaigns):
            parsed = fallback
        # Attach adset spec sketch alongside creatives
        adsets = [
            {
                "campaign_name": c.get("name"),
                "name": f"{c.get('name')} — Main AdSet",
                "daily_budget_cents": c.get("daily_budget_cents"),
                "billing_event": "IMPRESSIONS",
                "optimization_goal": "LINK_CLICKS" if "TRAFFIC" in (c.get("objective") or "") else "REACH",
            }
            for c in campaigns
        ]
        return {"proposed_creatives": parsed, "proposed_adsets": adsets}
