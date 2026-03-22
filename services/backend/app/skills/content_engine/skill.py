from app.skills.base import BaseSkill
from app.skills.content_engine.tools import TOOLS
from app.skills.content_engine.handlers import HANDLERS
from app.skills.content_engine.prompt import SYSTEM_PROMPT


class ContentEngineSkill(BaseSkill):
    @property
    def slug(self) -> str:
        return "content_engine"

    @property
    def name(self) -> str:
        return "Content Engine"

    @property
    def description(self) -> str:
        return "AI-powered content creation for blogs, social media, emails, and ad copy"

    @property
    def category(self) -> str:
        return "marketing"

    @property
    def icon(self) -> str:
        return "pen-tool"

    def get_tools(self) -> list[dict]:
        return TOOLS

    def get_handlers(self) -> dict:
        return HANDLERS

    def get_system_prompt_template(self) -> str:
        return SYSTEM_PROMPT
