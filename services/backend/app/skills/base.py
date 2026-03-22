"""Base skill interface for Ignify marketing modules."""

from abc import ABC, abstractmethod


class BaseSkill(ABC):
    """Abstract base class for all Ignify skills/modules."""

    @property
    @abstractmethod
    def slug(self) -> str:
        """Unique identifier for this skill."""
        ...

    @property
    @abstractmethod
    def name(self) -> str:
        """Display name."""
        ...

    @property
    @abstractmethod
    def description(self) -> str:
        """Short description."""
        ...

    @property
    def category(self) -> str:
        return "general"

    @property
    def icon(self) -> str:
        return "sparkles"

    @abstractmethod
    def get_tools(self) -> list[dict]:
        """Return OpenAI function-call format tool definitions."""
        ...

    @abstractmethod
    def get_handlers(self) -> dict[str, callable]:
        """Return mapping of tool_name -> async handler function."""
        ...

    @abstractmethod
    def get_system_prompt_template(self) -> str:
        """Return system prompt template with {placeholders}."""
        ...

    def get_config_schema(self) -> dict | None:
        """Return JSON schema for install-time configuration. None if no config needed."""
        return None
