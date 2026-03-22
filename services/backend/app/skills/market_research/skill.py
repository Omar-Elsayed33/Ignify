from app.skills.base import BaseSkill
from app.skills.market_research.tools import TOOLS
from app.skills.market_research.handlers import HANDLERS
from app.skills.market_research.prompt import SYSTEM_PROMPT


class MarketResearchSkill(BaseSkill):
    @property
    def slug(self) -> str:
        return "market_research"

    @property
    def name(self) -> str:
        return "Market Research"

    @property
    def description(self) -> str:
        return "Market analysis, customer sentiment, and business benchmarking"

    @property
    def category(self) -> str:
        return "intelligence"

    @property
    def icon(self) -> str:
        return "globe"

    def get_tools(self) -> list[dict]:
        return TOOLS

    def get_handlers(self) -> dict:
        return HANDLERS

    def get_system_prompt_template(self) -> str:
        return SYSTEM_PROMPT
