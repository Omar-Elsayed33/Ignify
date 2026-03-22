"""Skill registry - manages all registered skills and dispatches tool calls."""

from typing import Any
from app.skills.base import BaseSkill


class SkillRegistry:
    """Central registry for all Ignify skills/modules."""

    def __init__(self):
        self._skills: dict[str, BaseSkill] = {}
        self._tool_map: dict[str, str] = {}  # tool_name -> skill_slug

    def register(self, skill: BaseSkill) -> None:
        """Register a skill and index its tools."""
        self._skills[skill.slug] = skill
        for tool in skill.get_tools():
            tool_name = tool.get("function", {}).get("name", "")
            if tool_name:
                self._tool_map[tool_name] = skill.slug

    def get_skill(self, slug: str) -> BaseSkill | None:
        return self._skills.get(slug)

    def get_all_skills(self) -> list[BaseSkill]:
        return list(self._skills.values())

    def get_tools_for_skills(self, skill_slugs: list[str]) -> list[dict]:
        """Get combined tool definitions for a list of installed skill slugs."""
        tools = []
        for slug in skill_slugs:
            skill = self._skills.get(slug)
            if skill:
                tools.extend(skill.get_tools())
        return tools

    def get_system_prompt(self, skill_slugs: list[str], context: dict[str, Any] = None) -> str:
        """Build combined system prompt from installed skills."""
        context = context or {}
        prompts = []
        for slug in skill_slugs:
            skill = self._skills.get(slug)
            if skill:
                template = skill.get_system_prompt_template()
                try:
                    prompts.append(template.format(**context))
                except KeyError:
                    prompts.append(template)
        return "\n\n---\n\n".join(prompts)

    async def execute_tool(self, tool_name: str, arguments: dict, context: dict = None) -> str:
        """Dispatch a tool call to the correct skill handler."""
        skill_slug = self._tool_map.get(tool_name)
        if not skill_slug:
            return f"Unknown tool: {tool_name}"

        skill = self._skills.get(skill_slug)
        if not skill:
            return f"Skill not found: {skill_slug}"

        handlers = skill.get_handlers()
        handler = handlers.get(tool_name)
        if not handler:
            return f"No handler for tool: {tool_name}"

        try:
            result = await handler(arguments, context or {})
            return str(result)
        except Exception as e:
            return f"Tool execution error: {str(e)}"


# Global registry instance
registry = SkillRegistry()


def _register(skill: BaseSkill) -> None:
    """Helper to register a skill."""
    registry.register(skill)


# Import and register all skills
def init_skills():
    """Initialize all marketing skills. Call once at app startup."""
    from app.skills.content_engine.skill import ContentEngineSkill
    from app.skills.creative_engine.skill import CreativeEngineSkill
    from app.skills.seo_intelligence.skill import SEOIntelligenceSkill
    from app.skills.social_media.skill import SocialMediaSkill
    from app.skills.lead_crm.skill import LeadCRMSkill
    from app.skills.ads_orchestrator.skill import AdsOrchestratorSkill
    from app.skills.campaign_manager.skill import CampaignManagerSkill
    from app.skills.analytics.skill import AnalyticsSkill
    from app.skills.competitor_intel.skill import CompetitorIntelSkill
    from app.skills.market_research.skill import MarketResearchSkill

    _register(ContentEngineSkill())
    _register(CreativeEngineSkill())
    _register(SEOIntelligenceSkill())
    _register(SocialMediaSkill())
    _register(LeadCRMSkill())
    _register(AdsOrchestratorSkill())
    _register(CampaignManagerSkill())
    _register(AnalyticsSkill())
    _register(CompetitorIntelSkill())
    _register(MarketResearchSkill())
