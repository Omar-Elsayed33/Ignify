from app.skills.base import BaseSkill
from app.skills.seo_intelligence.tools import TOOLS
from app.skills.seo_intelligence.handlers import HANDLERS
from app.skills.seo_intelligence.prompt import SYSTEM_PROMPT


class SEOIntelligenceSkill(BaseSkill):
    @property
    def slug(self) -> str:
        return "seo_intelligence"

    @property
    def name(self) -> str:
        return "SEO Intelligence"

    @property
    def description(self) -> str:
        return "SEO analysis, keyword tracking, and site optimization"

    @property
    def category(self) -> str:
        return "marketing"

    @property
    def icon(self) -> str:
        return "search"

    def get_tools(self) -> list[dict]:
        return TOOLS

    def get_handlers(self) -> dict:
        return HANDLERS

    def get_system_prompt_template(self) -> str:
        return SYSTEM_PROMPT
