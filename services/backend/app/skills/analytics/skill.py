from app.skills.base import BaseSkill
from app.skills.analytics.tools import TOOLS
from app.skills.analytics.handlers import HANDLERS
from app.skills.analytics.prompt import SYSTEM_PROMPT


class AnalyticsSkill(BaseSkill):
    @property
    def slug(self) -> str:
        return "analytics"

    @property
    def name(self) -> str:
        return "Marketing Analytics"

    @property
    def description(self) -> str:
        return "Unified marketing analytics, reporting, and ROI tracking"

    @property
    def category(self) -> str:
        return "analytics"

    @property
    def icon(self) -> str:
        return "bar-chart-3"

    def get_tools(self) -> list[dict]:
        return TOOLS

    def get_handlers(self) -> dict:
        return HANDLERS

    def get_system_prompt_template(self) -> str:
        return SYSTEM_PROMPT
