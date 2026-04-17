"""Structured logging bootstrap.

Call `configure_logging()` once at startup. Obtain loggers via:

    from app.core.logging_config import get_logger
    log = get_logger(__name__)
    log.info("plan_generated", plan_id=str(plan.id), mode="fast")

Output is JSON in production and color/pretty in development, based on DEBUG flag.
"""
from __future__ import annotations

import logging
import sys

import structlog

from app.core.config import settings


def configure_logging() -> None:
    timestamper = structlog.processors.TimeStamper(fmt="iso")

    shared_processors: list = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        timestamper,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    if settings.DEBUG:
        renderer = structlog.dev.ConsoleRenderer(colors=True)
    else:
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=shared_processors + [renderer],
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Pipe stdlib logging to the same formatter so third-party logs use our pipeline.
    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root = logging.getLogger()
    # Avoid duplicate handlers on hot-reload.
    for existing in list(root.handlers):
        root.removeHandler(existing)
    root.addHandler(handler)
    root.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)

    # Tone down SQLAlchemy/uvicorn access noise.
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


def bind_request_context(request_id: str, tenant_id: str | None = None, user_id: str | None = None) -> None:
    """Bind per-request context so every subsequent log line includes request/tenant/user IDs.

    Call at the top of request middleware; structlog uses contextvars so the binding is
    automatically scoped to the current async task.
    """
    structlog.contextvars.clear_contextvars()
    ctx = {"request_id": request_id}
    if tenant_id:
        ctx["tenant_id"] = tenant_id
    if user_id:
        ctx["user_id"] = user_id
    structlog.contextvars.bind_contextvars(**ctx)


def get_logger(name: str | None = None):
    return structlog.get_logger(name)
