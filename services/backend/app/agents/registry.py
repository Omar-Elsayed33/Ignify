"""Agent registry — maps agent name to class."""
from __future__ import annotations

from typing import Type

from app.agents.base import BaseAgent

AGENT_REGISTRY: dict[str, Type[BaseAgent]] = {}


def register_agent(cls: Type[BaseAgent]) -> Type[BaseAgent]:
    """Decorator to register an agent class by its `name`."""
    if not cls.name or cls.name == "agent":
        raise ValueError(f"Agent {cls.__name__} must define a unique `name` class attribute")
    AGENT_REGISTRY[cls.name] = cls
    return cls


def get_agent(name: str, tenant_id: str, model_override: str | None = None) -> BaseAgent:
    if name not in AGENT_REGISTRY:
        raise KeyError(f"Unknown agent: {name}. Registered: {list(AGENT_REGISTRY)}")
    return AGENT_REGISTRY[name](tenant_id=tenant_id, model_override=model_override)
