"""TikTok connector — OAuth 2.0 + Content Posting API (v2, PULL_FROM_URL).

TikTok downloads the video from a publicly reachable URL we provide, which
means media_urls[0] must be publicly accessible (not a signed/temporary URL
that expires in seconds).

Requires approval from TikTok for the `video.publish` scope.

Docs:
- OAuth: https://developers.tiktok.com/doc/login-kit-web
- Content Posting: https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import ClassVar
from urllib.parse import urlencode

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.db.models import SocialAccount, SocialPlatform

from .base import PublishResult, TokenBundle

AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/"
TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"
USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/"
POST_INIT_URL = "https://open.tiktokapis.com/v2/post/publish/video/init/"


class TikTokConnector:
    platform = SocialPlatform.tiktok
    scopes: ClassVar[list[str]] = ["user.info.basic", "video.publish", "video.upload"]
    requires_media = True
    supports_refresh = True

    def is_configured(self) -> bool:
        return bool(settings.TIKTOK_CLIENT_KEY and settings.TIKTOK_CLIENT_SECRET)

    def build_auth_url(self, state: str) -> str:
        params = {
            "client_key": settings.TIKTOK_CLIENT_KEY,
            "scope": ",".join(self.scopes),
            "response_type": "code",
            "redirect_uri": settings.TIKTOK_REDIRECT_URI,
            "state": state,
        }
        return f"{AUTH_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str) -> TokenBundle:
        async with httpx.AsyncClient(timeout=20.0) as client:
            tok = await client.post(
                TOKEN_URL,
                data={
                    "client_key": settings.TIKTOK_CLIENT_KEY,
                    "client_secret": settings.TIKTOK_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": settings.TIKTOK_REDIRECT_URI,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            tok.raise_for_status()
            td = tok.json()
            access_token = td.get("access_token")
            refresh_token = td.get("refresh_token")
            expires_in = td.get("expires_in")
            open_id = td.get("open_id")

            info = await client.get(
                USER_INFO_URL,
                params={"fields": "open_id,union_id,display_name,avatar_url"},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            # Non-fatal if it fails; we still have open_id
            info_user = {}
            if info.status_code < 400:
                info_user = info.json().get("data", {}).get("user", {}) or {}

        if not open_id or not access_token:
            raise RuntimeError("TikTok OAuth response missing open_id/access_token")

        display = info_user.get("display_name") or f"TikTok:{open_id[:8]}"
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
                "platform": SocialPlatform.tiktok,
                "account_id": open_id,
                "name": display,
                "access_token": access_token,
            }],
        )

    async def refresh(self, account: SocialAccount) -> TokenBundle | None:
        return None

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=20))
    async def publish(
        self,
        account: SocialAccount,
        content: str,
        media_urls: list[str],
    ) -> PublishResult:
        if not media_urls:
            raise ValueError("TikTok publish requires a video URL")
        token = account.access_token_encrypted or ""
        video_url = media_urls[0]

        body = {
            "post_info": {
                "title": content[:150],
                "privacy_level": "PUBLIC_TO_EVERYONE",
                "disable_duet": False,
                "disable_comment": False,
                "disable_stitch": False,
            },
            "source_info": {
                "source": "PULL_FROM_URL",
                "video_url": video_url,
            },
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                POST_INIT_URL,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json; charset=UTF-8",
                },
                content=json.dumps(body),
            )
            resp.raise_for_status()
            data = resp.json().get("data", {}) or {}

        publish_id = str(data.get("publish_id") or "")
        # TikTok returns a publish_id — the actual video URL is only available
        # after async processing. We store publish_id as external_id; the UI
        # can open TikTok's upload dashboard to confirm.
        return PublishResult(external_id=publish_id)
