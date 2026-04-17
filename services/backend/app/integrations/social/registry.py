"""Connector registry — `registry[platform]` → connector instance."""
from __future__ import annotations

from typing import Iterable

from app.db.models import SocialPlatform

from .base import SocialConnector
from .linkedin import LinkedInConnector
from .meta import FacebookConnector, InstagramConnector
from .snapchat import SnapchatConnector
from .tiktok import TikTokConnector
from .x import XConnector
from .youtube import YouTubeConnector

_registry: dict[SocialPlatform, SocialConnector] = {
    SocialPlatform.facebook: FacebookConnector(),
    SocialPlatform.instagram: InstagramConnector(),
    SocialPlatform.linkedin: LinkedInConnector(),
    SocialPlatform.twitter: XConnector(),
    SocialPlatform.youtube: YouTubeConnector(),
    SocialPlatform.tiktok: TikTokConnector(),
    SocialPlatform.snapchat: SnapchatConnector(),
}


def get_connector(platform: SocialPlatform | str) -> SocialConnector | None:
    if isinstance(platform, str):
        try:
            platform = SocialPlatform(platform)
        except ValueError:
            return None
    return _registry.get(platform)


def iter_connectors() -> Iterable[tuple[SocialPlatform, SocialConnector]]:
    return _registry.items()
