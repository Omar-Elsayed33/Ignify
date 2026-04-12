"""Structured JSON logging.

Only swap in the JSON formatter when NOT in DEBUG mode — in DEBUG we keep
uvicorn's human-readable default so local dev output stays readable.
"""
from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        data = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            data["exception"] = self.formatException(record.exc_info)
        for attr in ("tenant_id", "user_id", "agent_name", "run_id"):
            if hasattr(record, attr):
                data[attr] = getattr(record, attr)
        return json.dumps(data, default=str)


def setup_logging(level: str = "INFO", *, json_format: bool = True) -> None:
    handler = logging.StreamHandler(sys.stdout)
    if json_format:
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
        )
    root = logging.getLogger()
    root.handlers = [handler]
    try:
        root.setLevel(level)
    except (ValueError, TypeError):
        root.setLevel(logging.INFO)
