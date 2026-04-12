"""Base classes for Ignify agents and sub-agents."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from langchain_openai import ChatOpenAI
from langgraph.graph.state import CompiledStateGraph

from app.core.llm import get_llm
from app.agents.models import MODEL_TIERS, resolve_model


class BaseSubAgent(ABC):
    """A specialist LLM call used as a node inside an agent graph."""

    name: str = "sub_agent"
    model_tier: str = "balanced"
    system_prompt: str = ""

    def __init__(self, tenant_id: str, model_override: str | None = None):
        self.tenant_id = tenant_id
        self.model = model_override or MODEL_TIERS[self.model_tier]
        self.llm: ChatOpenAI = get_llm(self.model, tenant_id)

    @abstractmethod
    async def execute(self, state: dict[str, Any]) -> dict[str, Any]:
        """Return a partial state update (merged into the graph state)."""
        ...


class BaseAgent(ABC):
    """Top-level agent that orchestrates sub-agents via a LangGraph."""

    name: str = "agent"
    system_prompt: str = ""

    def __init__(self, tenant_id: str, model_override: str | None = None):
        self.tenant_id = tenant_id
        self.model = resolve_model(self.name, model_override)
        self.llm: ChatOpenAI = get_llm(self.model, tenant_id)
        self._graph: CompiledStateGraph | None = None

    @abstractmethod
    def build_graph(self) -> CompiledStateGraph:
        """Build and compile the LangGraph for this agent."""
        ...

    @property
    def graph(self) -> CompiledStateGraph:
        if self._graph is None:
            self._graph = self.build_graph()
        return self._graph

    async def run(
        self,
        input_data: dict[str, Any],
        thread_id: str,
        tracer: Any | None = None,
    ) -> dict[str, Any]:
        config: dict[str, Any] = {"configurable": {"thread_id": f"{self.tenant_id}:{thread_id}"}}
        if tracer is not None:
            config["callbacks"] = [tracer]
        return await self.graph.ainvoke(input_data, config=config)

    async def stream(self, input_data: dict[str, Any], thread_id: str, tracer: Any | None = None):
        config: dict[str, Any] = {"configurable": {"thread_id": f"{self.tenant_id}:{thread_id}"}}
        if tracer is not None:
            config["callbacks"] = [tracer]
        async for event in self.graph.astream_events(input_data, config=config, version="v2"):
            yield event
