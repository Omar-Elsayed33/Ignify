"""VideoAgent — generates AI short videos end-to-end."""
from __future__ import annotations

from langgraph.graph import StateGraph, END

from app.agents.base import BaseAgent
from app.agents.checkpointer import get_checkpointer
from app.agents.registry import register_agent
from app.agents.video.state import VideoState
from app.agents.video.subagents.script_writer import ScriptWriter
from app.agents.video.subagents.scene_planner import ScenePlanner
from app.agents.video.subagents.voice_selector import VoiceSelector
from app.agents.video.subagents.voice_renderer import run_voice_renderer
from app.agents.video.subagents.video_renderer import run_video_renderer
from app.agents.video.subagents.caption_generator import run_caption_generator


@register_agent
class VideoAgent(BaseAgent):
    name = "video"
    system_prompt = (
        "You orchestrate a team of video sub-agents to produce a short-form social video "
        "(script, scene plan, voiceover, rendered video, captions) from a short user idea."
    )

    def build_graph(self):
        g = StateGraph(VideoState)

        async def _script(state):
            return await ScriptWriter(state["tenant_id"]).execute(state)

        async def _scenes(state):
            return await ScenePlanner(state["tenant_id"]).execute(state)

        async def _voice_select(state):
            return await VoiceSelector(state["tenant_id"]).execute(state)

        async def _voice_render(state):
            return await run_voice_renderer(state)

        async def _video_render(state):
            return await run_video_renderer(state)

        async def _captions(state):
            return await run_caption_generator(state)

        g.add_node("script_writer", _script)
        g.add_node("scene_planner", _scenes)
        g.add_node("voice_selector", _voice_select)
        g.add_node("voice_renderer", _voice_render)
        g.add_node("video_renderer", _video_render)
        g.add_node("caption_generator", _captions)

        g.set_entry_point("script_writer")
        g.add_edge("script_writer", "scene_planner")
        g.add_edge("scene_planner", "voice_selector")
        g.add_edge("voice_selector", "voice_renderer")
        g.add_edge("voice_renderer", "video_renderer")
        g.add_edge("video_renderer", "caption_generator")
        g.add_edge("caption_generator", END)

        return g.compile(checkpointer=get_checkpointer())
