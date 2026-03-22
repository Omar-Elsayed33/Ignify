from app.skills.base import BaseSkill
from app.skills.social_media.tools import TOOLS
from app.skills.social_media.handlers import HANDLERS
from app.skills.social_media.prompt import SYSTEM_PROMPT


class SocialMediaSkill(BaseSkill):
    @property
    def slug(self) -> str:
        return "social_media"

    @property
    def name(self) -> str:
        return "Social Media"

    @property
    def description(self) -> str:
        return "Multi-platform social media management, scheduling, and analytics"

    @property
    def category(self) -> str:
        return "marketing"

    @property
    def icon(self) -> str:
        return "share-2"

    def get_tools(self) -> list[dict]:
        return TOOLS

    def get_handlers(self) -> dict:
        return HANDLERS

    def get_system_prompt_template(self) -> str:
        return SYSTEM_PROMPT
