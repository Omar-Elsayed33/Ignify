"""Default model mapping per agent. Can be overridden per-tenant via DB."""

# Tiered aliases — use these for sub-agents to allow global swaps.
# Model IDs must match OpenRouter catalog exactly — https://openrouter.ai/models
MODEL_TIERS = {
    "fast": "google/gemini-2.5-flash",
    "balanced": "google/gemini-2.5-flash",
    "smart": "google/gemini-2.5-flash",
    "vision": "google/gemini-2.5-flash",
    "search": "google/gemini-2.5-flash",
    "long_context": "google/gemini-2.5-flash",
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
