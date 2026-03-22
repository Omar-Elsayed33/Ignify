from app.skills.base import BaseSkill
from app.skills.lead_crm.tools import TOOLS
from app.skills.lead_crm.handlers import HANDLERS
from app.skills.lead_crm.prompt import SYSTEM_PROMPT


class LeadCRMSkill(BaseSkill):
    @property
    def slug(self) -> str:
        return "lead_crm"

    @property
    def name(self) -> str:
        return "Lead CRM"

    @property
    def description(self) -> str:
        return "Lead capture, scoring, pipeline management, and follow-up automation"

    @property
    def category(self) -> str:
        return "management"

    @property
    def icon(self) -> str:
        return "users"

    def get_tools(self) -> list[dict]:
        return TOOLS

    def get_handlers(self) -> dict:
        return HANDLERS

    def get_system_prompt_template(self) -> str:
        return SYSTEM_PROMPT
