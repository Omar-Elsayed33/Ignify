from app.skills.base import BaseSkill
from app.skills.creative_engine.tools import TOOLS
from app.skills.creative_engine.handlers import HANDLERS
from app.skills.creative_engine.prompt import SYSTEM_PROMPT


class CreativeEngineSkill(BaseSkill):
    @property
    def slug(self) -> str:
        return "creative_engine"

    @property
    def name(self) -> str:
        return "Creative Engine"

    @property
    def description(self) -> str:
        return "AI image generation and visual asset creation"

    @property
    def category(self) -> str:
        return "marketing"

    @property
    def icon(self) -> str:
        return "image"

    def get_tools(self) -> list[dict]:
        return TOOLS

    def get_handlers(self) -> dict:
        return HANDLERS

    def get_system_prompt_template(self) -> str:
        return SYSTEM_PROMPT
