from app.skills.base import BaseSkill
from app.skills.campaign_manager.tools import TOOLS
from app.skills.campaign_manager.handlers import HANDLERS
from app.skills.campaign_manager.prompt import SYSTEM_PROMPT


class CampaignManagerSkill(BaseSkill):
    @property
    def slug(self) -> str:
        return "campaign_manager"

    @property
    def name(self) -> str:
        return "Campaign Manager"

    @property
    def description(self) -> str:
        return "Multi-channel campaign orchestration with workflows and A/B testing"

    @property
    def category(self) -> str:
        return "marketing"

    @property
    def icon(self) -> str:
        return "rocket"

    def get_tools(self) -> list[dict]:
        return TOOLS

    def get_handlers(self) -> dict:
        return HANDLERS

    def get_system_prompt_template(self) -> str:
        return SYSTEM_PROMPT
