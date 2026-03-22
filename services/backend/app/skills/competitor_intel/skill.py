from app.skills.base import BaseSkill
from app.skills.competitor_intel.tools import TOOLS
from app.skills.competitor_intel.handlers import HANDLERS
from app.skills.competitor_intel.prompt import SYSTEM_PROMPT


class CompetitorIntelSkill(BaseSkill):
    @property
    def slug(self) -> str:
        return "competitor_intel"

    @property
    def name(self) -> str:
        return "Competitor Intelligence"

    @property
    def description(self) -> str:
        return "Monitor competitors' marketing strategies, ads, and performance"

    @property
    def category(self) -> str:
        return "intelligence"

    @property
    def icon(self) -> str:
        return "eye"

    def get_tools(self) -> list[dict]:
        return TOOLS

    def get_handlers(self) -> dict:
        return HANDLERS

    def get_system_prompt_template(self) -> str:
        return SYSTEM_PROMPT
