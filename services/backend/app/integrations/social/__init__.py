"""Social media integrations — one connector per platform, uniform interface.

Inspired by the Postiz plugin layout (libraries/nestjs-libraries/src/integrations/social/*)
but re-implemented natively in Python/httpx for Ignify's FastAPI + Celery stack.

Add a new platform by:
1. Creating ``<platform>.py`` that implements ``SocialConnector``.
2. Registering it in ``registry.py``.
3. Adding any required settings to ``app/core/config.py``.
"""
from .base import PublishResult, SocialConnector, TokenBundle  # noqa: F401
from .registry import get_connector, iter_connectors  # noqa: F401
