"""Shared helpers for strategy sub-agents."""
from __future__ import annotations

import json
import re
from typing import Any


JSON_BLOCK = re.compile(r"```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```", re.DOTALL)


def parse_json_response(content: str, fallback: Any) -> Any:
    """Extract JSON from LLM response, tolerating code fences and prose."""
    if not content:
        return fallback

    match = JSON_BLOCK.search(content)
    raw = match.group(1) if match else content.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Try to locate first {...} or [...] block
        for opener, closer in (("{", "}"), ("[", "]")):
            start = raw.find(opener)
            end = raw.rfind(closer)
            if start != -1 and end > start:
                try:
                    return json.loads(raw[start : end + 1])
                except json.JSONDecodeError:
                    continue
        return fallback
