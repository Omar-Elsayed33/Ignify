"""YouTube connector — OAuth 2.0 + Data API v3 video upload.

Uploads videos via the "multipart" simple upload (<256 MB). Resumable upload
is needed for larger files — deferred.

Docs:
- OAuth: https://developers.google.com/identity/protocols/oauth2/web-server
- Video upload: https://developers.google.com/youtube/v3/docs/videos/insert
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

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos"
CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels"


class YouTubeConnector:
    platform = SocialPlatform.youtube
    scopes: ClassVar[list[str]] = [
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube.readonly",
    ]
    requires_media = True   # videos only
    supports_refresh = True

    def is_configured(self) -> bool:
        return bool(settings.YOUTUBE_CLIENT_ID and settings.YOUTUBE_CLIENT_SECRET)

    def build_auth_url(self, state: str) -> str:
        params = {
            "response_type": "code",
            "client_id": settings.YOUTUBE_CLIENT_ID,
            "redirect_uri": settings.YOUTUBE_REDIRECT_URI,
            "scope": " ".join(self.scopes),
            "state": state,
            "access_type": "offline",   # to receive refresh_token
            "prompt": "consent",
            "include_granted_scopes": "true",
        }
        return f"{AUTH_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str) -> TokenBundle:
        async with httpx.AsyncClient(timeout=20.0) as client:
            tok = await client.post(
                TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.YOUTUBE_CLIENT_ID,
                    "client_secret": settings.YOUTUBE_CLIENT_SECRET,
                    "redirect_uri": settings.YOUTUBE_REDIRECT_URI,
                    "grant_type": "authorization_code",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            tok.raise_for_status()
            td = tok.json()
            access_token = td["access_token"]
            refresh_token = td.get("refresh_token")
            expires_in = td.get("expires_in")

            ch = await client.get(
                CHANNELS_URL,
                params={"part": "snippet", "mine": "true"},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            ch.raise_for_status()
            items = ch.json().get("items", [])
        if not items:
            raise RuntimeError("YouTube account has no channel")
        channel = items[0]
        channel_id = channel["id"]
        channel_name = channel.get("snippet", {}).get("title") or channel_id

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
                "platform": SocialPlatform.youtube,
                "account_id": channel_id,
                "name": channel_name,
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
            raise ValueError("YouTube publish requires a video URL")
        token = account.access_token_encrypted or ""
        video_url = media_urls[0]

        # Split `content` into title/description: first line = title (<=100 chars).
        first_nl = content.find("\n")
        title = (content[:first_nl] if first_nl != -1 else content)[:100].strip() or "Untitled"
        description = content[first_nl + 1 :].strip() if first_nl != -1 else ""

        metadata = {
            "snippet": {"title": title, "description": description, "categoryId": "22"},
            "status": {"privacyStatus": "public", "selfDeclaredMadeForKids": False},
        }

        async with httpx.AsyncClient(timeout=None) as client:
            vid = await client.get(video_url)
            vid.raise_for_status()
            video_bytes = vid.content
            # Multipart upload — RFC 2387 `related`
            boundary = "ignify-yt-boundary-8x3f"
            body = (
                f"--{boundary}\r\n"
                "Content-Type: application/json; charset=UTF-8\r\n\r\n"
                f"{json.dumps(metadata)}\r\n"
                f"--{boundary}\r\n"
                "Content-Type: video/*\r\n\r\n"
            ).encode() + video_bytes + f"\r\n--{boundary}--\r\n".encode()

            resp = await client.post(
                UPLOAD_URL,
                params={"part": "snippet,status", "uploadType": "multipart"},
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": f"multipart/related; boundary={boundary}",
                },
                content=body,
            )
            resp.raise_for_status()
            data = resp.json()

        video_id = data.get("id") or ""
        return PublishResult(
            external_id=str(video_id),
            url=f"https://www.youtube.com/watch?v={video_id}" if video_id else None,
        )
