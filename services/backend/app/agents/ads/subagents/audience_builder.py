"""AudienceBuilder — derives a Meta targeting spec from personas/audience info."""
from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import BaseSubAgent
from app.agents.strategy.subagents._helpers import parse_json_response


class AudienceBuilder(BaseSubAgent):
    name = "audience_builder"
    model_tier = "balanced"
    system_prompt = (
        "You are a Meta Ads targeting expert. Given a target audience description "
        "(personas, demographics, interests), output a Meta `targeting` spec JSON. "
        "Return STRICT JSON only with the shape:\n"
        '{"geo_locations": {"countries": ["US"]}, "age_min": 18, "age_max": 65, '
        '"genders": [1,2], "interests": [{"id": "", "name": "Marketing"}], '
        '"publisher_platforms": ["facebook","instagram"], '
        '"facebook_positions": ["feed"], "instagram_positions": ["stream"]}\n'
        "Pick sensible defaults when the audience is vague. No prose, JSON only."
    )

    async def execute(self, state):
        audience = state.get("target_audience") or {}
        products = state.get("products") or []
        lang = state.get("language", "en")
        user = (
            f"Language: {lang}\n"
            f"Audience:\n{audience}\n\n"
            f"Products:\n{products}\n\n"
            "Return the targeting JSON now."
        )
        resp = await self.llm.ainvoke(
            [SystemMessage(content=self.system_prompt), HumanMessage(content=user)]
        )
        fallback = {
            "geo_locations": {"countries": ["US", "SA", "AE", "EG"]},
            "age_min": 18,
            "age_max": 55,
            "publisher_platforms": ["facebook", "instagram"],
            "facebook_positions": ["feed"],
            "instagram_positions": ["stream"],
        }
        spec = parse_json_response(resp.content, fallback=fallback)
        if not isinstance(spec, dict):
            spec = fallback
        return {"targeting_spec": spec}
