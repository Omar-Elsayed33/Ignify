"""
Ignify AGNO Runtime - AI Execution Engine
Zero database connections. Pure AI execution with tool calling loop.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx
import json
import os

app = FastAPI(title="Ignify AGNO Runtime", version="1.0.0")

MAX_TOOL_ROUNDS = 5


class ToolDefinition(BaseModel):
    type: str = "function"
    function: dict


class ExecuteRequest(BaseModel):
    provider: str  # openai, anthropic, google, openrouter
    api_key: str
    model: str
    system_prompt: str
    messages: list[dict]
    tools: list[dict] = []
    tool_callback_url: str | None = None
    temperature: float = 0.7
    max_tokens: int = 4096


class ExecuteResponse(BaseModel):
    response: str
    tool_calls_made: int = 0
    usage: dict = {}


def get_api_base(provider: str) -> str:
    bases = {
        "openai": "https://api.openai.com/v1",
        "anthropic": "https://api.anthropic.com/v1",
        "google": "https://generativelanguage.googleapis.com/v1beta",
        "openrouter": "https://openrouter.ai/api/v1",
    }
    return bases.get(provider, bases["openai"])


async def call_openai_compatible(
    api_base: str,
    api_key: str,
    model: str,
    messages: list[dict],
    tools: list[dict],
    temperature: float,
    max_tokens: int,
    is_openrouter: bool = False,
) -> dict:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if is_openrouter:
        headers["HTTP-Referer"] = "https://ignify.com"
        headers["X-Title"] = "Ignify"

    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{api_base}/chat/completions",
            headers=headers,
            json=payload,
        )
        if resp.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"AI provider error: {resp.status_code} - {resp.text}",
            )
        return resp.json()


async def call_anthropic(
    api_key: str,
    model: str,
    system_prompt: str,
    messages: list[dict],
    tools: list[dict],
    temperature: float,
    max_tokens: int,
) -> dict:
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }

    # Convert OpenAI tools format to Anthropic format
    anthropic_tools = []
    for tool in tools:
        if tool.get("type") == "function":
            fn = tool["function"]
            anthropic_tools.append({
                "name": fn["name"],
                "description": fn.get("description", ""),
                "input_schema": fn.get("parameters", {"type": "object", "properties": {}}),
            })

    # Filter out system messages from messages (Anthropic uses separate system param)
    filtered = [m for m in messages if m["role"] != "system"]

    payload = {
        "model": model,
        "system": system_prompt,
        "messages": filtered,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if anthropic_tools:
        payload["tools"] = anthropic_tools

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers=headers,
            json=payload,
        )
        if resp.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Anthropic error: {resp.status_code} - {resp.text}",
            )
        data = resp.json()

    # Convert Anthropic response to OpenAI-like format
    content_text = ""
    tool_calls = []
    for block in data.get("content", []):
        if block["type"] == "text":
            content_text += block["text"]
        elif block["type"] == "tool_use":
            tool_calls.append({
                "id": block["id"],
                "type": "function",
                "function": {
                    "name": block["name"],
                    "arguments": json.dumps(block["input"]),
                },
            })

    choice = {
        "message": {
            "role": "assistant",
            "content": content_text or None,
        },
        "finish_reason": "stop" if data.get("stop_reason") == "end_turn" else "tool_calls",
    }
    if tool_calls:
        choice["message"]["tool_calls"] = tool_calls
        choice["finish_reason"] = "tool_calls"

    return {
        "choices": [choice],
        "usage": {
            "prompt_tokens": data.get("usage", {}).get("input_tokens", 0),
            "completion_tokens": data.get("usage", {}).get("output_tokens", 0),
        },
    }


async def execute_tool_callback(callback_url: str, tool_name: str, arguments: dict) -> str:
    """Call backend to execute a tool and return the result."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            callback_url,
            json={
                "tool_name": tool_name,
                "arguments": arguments,
            },
        )
        if resp.status_code == 200:
            return resp.json().get("result", "Tool executed successfully")
        return f"Tool execution failed: {resp.status_code}"


@app.post("/execute", response_model=ExecuteResponse)
async def execute(req: ExecuteRequest):
    """Execute AI request with optional tool calling loop."""
    messages = [{"role": "system", "content": req.system_prompt}] + req.messages
    tool_calls_count = 0

    for _round in range(MAX_TOOL_ROUNDS):
        # Call AI provider
        if req.provider == "anthropic":
            result = await call_anthropic(
                api_key=req.api_key,
                model=req.model,
                system_prompt=req.system_prompt,
                messages=messages,
                tools=req.tools,
                temperature=req.temperature,
                max_tokens=req.max_tokens,
            )
        else:
            is_openrouter = req.provider == "openrouter"
            api_base = get_api_base(req.provider)
            result = await call_openai_compatible(
                api_base=api_base,
                api_key=req.api_key,
                model=req.model,
                messages=messages,
                tools=req.tools,
                temperature=req.temperature,
                max_tokens=req.max_tokens,
                is_openrouter=is_openrouter,
            )

        choice = result["choices"][0]
        assistant_msg = choice["message"]
        messages.append(assistant_msg)

        # Check if there are tool calls
        if choice.get("finish_reason") == "tool_calls" and assistant_msg.get("tool_calls"):
            for tc in assistant_msg["tool_calls"]:
                tool_name = tc["function"]["name"]
                arguments = json.loads(tc["function"]["arguments"])
                tool_calls_count += 1

                # Execute tool via callback
                if req.tool_callback_url:
                    tool_result = await execute_tool_callback(
                        req.tool_callback_url, tool_name, arguments
                    )
                else:
                    tool_result = f"No callback URL configured for tool: {tool_name}"

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": tool_result,
                })
        else:
            # No tool calls, return final response
            return ExecuteResponse(
                response=assistant_msg.get("content", ""),
                tool_calls_made=tool_calls_count,
                usage=result.get("usage", {}),
            )

    # Max rounds reached
    last_content = messages[-1].get("content", "I've reached my processing limit.")
    return ExecuteResponse(
        response=last_content,
        tool_calls_made=tool_calls_count,
        usage={},
    )


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ignify-agno-runtime"}
