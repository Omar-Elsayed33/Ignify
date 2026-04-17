"""Snapchat connector — OAuth 2.0 (Login Kit) + graceful publish-not-supported.

Snapchat has **no public API for posting Snaps/Stories from third-party
servers**. Their developer surfaces are:
  - Login Kit (identity federation)
  - Creative Kit (mobile-side share intents, requires a native SDK)
  - Ads / Marketing API (paid ads, not organic content)

So we implement OAuth so users can still *connect* Snapchat (useful later if
TikTok-style content APIs open up), but `publish()` raises a clear error
explaining the limitation. The scheduler should surface it to the user and
suggest switching to manual mode.

Docs: https://developers.snap.com/api/docs/login-kit
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import ClassVar
from urllib.parse import urlencode

import httpx

from app.core.config import settings
from app.db.models import SocialAccount, SocialPlatform

from .base import PublishResult, TokenBundle

AUTH_URL = "https://accounts.snapchat.com/accounts/oauth2/auth"
TOKEN_URL = "https://accounts.snapchat.com/accounts/oauth2/token"
ME_URL = "https://kit.snapchat.com/v1/me"


class SnapchatConnector:
    platform = SocialPlatform.snapchat
    scopes: ClassVar[list[str]] = [
        "https://auth.snapchat.com/oauth2/api/user.display_name",
        "https://auth.snapchat.com/oauth2/api/user.external_id",
    ]
    requires_media = True
    supports_refresh = True

    def is_configured(self) -> bool:
        return bool(settings.SNAPCHAT_CLIENT_ID and settings.SNAPCHAT_CLIENT_SECRET)

    def build_auth_url(self, state: str) -> str:
        params = {
            "response_type": "code",
            "client_id": settings.SNAPCHAT_CLIENT_ID,
            "redirect_uri": settings.SNAPCHAT_REDIRECT_URI,
            "scope": " ".join(self.scopes),
            "state": state,
        }
        return f"{AUTH_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str) -> TokenBundle:
        async with httpx.AsyncClient(timeout=20.0) as client:
            tok = await client.post(
                TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": settings.SNAPCHAT_REDIRECT_URI,
                    "client_id": settings.SNAPCHAT_CLIENT_ID,
                    "client_secret": settings.SNAPCHAT_CLIENT_SECRET,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            tok.raise_for_status()
            td = tok.json()
            access_token = td["access_token"]
            refresh_token = td.get("refresh_token")
            expires_in = td.get("expires_in")

            me = await client.post(
                ME_URL,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                content='{"query":"{me{displayName externalId}}"}',
            )
            user = {}
            if me.status_code < 400:
                user = me.json().get("data", {}).get("me", {}) or {}

        external_id = user.get("externalId") or "snap-user"
        display_name = user.get("displayName") or external_id

        expires_at = (
            datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))
            if expires_in
            else None
        )
        return TokenBundle(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=expires_at,
            accounts=[{
                "platform": SocialPlatform.snapchat,
                "account_id": external_id,
                "name": display_name,
                "access_token": access_token,
            }],
        )

    async def refresh(self, account: SocialAccount) -> TokenBundle | None:
        return None

    async def publish(
        self,
        account: SocialAccount,
        content: str,
        media_urls: list[str],
    ) -> PublishResult:
        raise NotImplementedError(
            "Snapchat has no public server-to-server posting API. "
            "Use manual publish mode and share from the Snapchat mobile app."
        )
