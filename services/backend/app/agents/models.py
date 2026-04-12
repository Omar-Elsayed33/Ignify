"""Default model mapping per agent. Can be overridden per-tenant via DB."""

# Tiered aliases — use these for sub-agents to allow global swaps.
# Model IDs must match OpenRouter catalog exactly — https://openrouter.ai/models
MODEL_TIERS = {
    "fast": "openai/gpt-4o-mini",
    "balanced": "openai/gpt-4o-mini",
    "smart": "openai/gpt-4o",
    "vision": "openai/gpt-4o",
    "search": "openai/gpt-4o-mini",
    "long_context": "google/gemini-2.0-flash-exp",
}

# Default model per top-level agent.
AGENT_MODELS = {
    "strategy":   MODEL_TIERS["smart"],
    "content":    MODEL_TIERS["balanced"],
    "creative":   MODEL_TIERS["vision"],
    "video":      MODEL_TIERS["balanced"],
    "inbox":      MODEL_TIERS["fast"],
    "ads":        MODEL_TIERS["smart"],
    "seo":        MODEL_TIERS["long_context"],
    "analytics":  MODEL_TIERS["balanced"],
    "lead":       MODEL_TIERS["fast"],
    "research":   MODEL_TIERS["search"],
    "competitor": MODEL_TIERS["balanced"],
    "campaign":   MODEL_TIERS["smart"],
}


def resolve_model(agent_name: str, override: str | None = None) -> str:
    if override:
        return override
    return AGENT_MODELS.get(agent_name, MODEL_TIERS["balanced"])
