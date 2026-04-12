from typing import Optional

from pydantic import BaseModel


class AgentConfigItem(BaseModel):
    agent_name: str
    model: str  # effective
    system_prompt: Optional[str] = None  # effective
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    is_enabled: bool = True
    is_overridden: bool = False


class AgentConfigUpdate(BaseModel):
    model: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    is_enabled: Optional[bool] = None
