from app.skills.base import BaseSkill
from app.skills.ads_orchestrator.tools import TOOLS
from app.skills.ads_orchestrator.handlers import HANDLERS
from app.skills.ads_orchestrator.prompt import SYSTEM_PROMPT


class AdsOrchestratorSkill(BaseSkill):
    @property
    def slug(self) -> str:
        return "ads_orchestrator"

    @property
    def name(self) -> str:
        return "Ads Orchestrator"

    @property
    def description(self) -> str:
        return "Manage and optimize ads across Google, Meta, Snapchat, and YouTube"

    @property
    def category(self) -> str:
        return "marketing"

    @property
    def icon(self) -> str:
        return "megaphone"

    def get_tools(self) -> list[dict]:
        return TOOLS

    def get_handlers(self) -> dict:
        return HANDLERS

    def get_system_prompt_template(self) -> str:
        return SYSTEM_PROMPT
