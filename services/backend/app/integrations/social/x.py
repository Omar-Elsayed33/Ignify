"""X (Twitter) connector — OAuth 2.0 w/ PKCE + API v2.

Note: posting requires a Basic-tier developer account (or higher). Free tier
is read-only as of 2024. The code paths still work for approved apps.

Docs:
- OAuth 2.0 + PKCE: https://docs.x.com/resources/fundamentals/authentication/oauth-2-0/authorization-code
- Create tweet: https://docs.x.com/x-api/posts/creation-of-a-post
- Media upload v1.1: https://developer.x.com/en/docs/x-api/v1/media/upload-media/api-reference/post-media-upload
"""
from __future__ import annotations

import base64
import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import ClassVar
from urllib.parse import urlencode

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.db.models import SocialAccount, SocialPlatform

from . import oauth_state
from .base import PublishResult, TokenBundle, get_access_token

AUTH_URL = "https://twitter.com/i/oauth2/authorize"
TOKEN_URL = "https://api.twitter.com/2/oauth2/token"
ME_URL = "https://api.twitter.com/2/users/me"
TWEETS_URL = "https://api.twitter.com/2/tweets"
MEDIA_UPLOAD_URL = "https://upload.twitter.com/1.1/media/upload.json"


def _pkce_pair() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(48)[:128]
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).decode().rstrip("=")
    return verifier, challenge


# Separate state→verifier store so oauth_state.extra can remain immutable.
_pkce_verifiers: dict[str, str] = {}


class XConnector:
    platform = SocialPlatform.twitter
    scopes: ClassVar[list[str]] = ["tweet.read", "tweet.write", "users.read", "offline.access"]
    requires_media = False
    supports_refresh = True

    def is_configured(self) -> bool:
        return bool(settings.X_CLIENT_ID and settings.X_CLIENT_SECRET)

    def build_auth_url(self, state: str) -> str:
        verifier, challenge = _pkce_pair()
        _pkce_verifiers[state] = verifier
        params = {
            "response_type": "code",
            "client_id": settings.X_CLIENT_ID,
            "redirect_uri": settings.X_REDIRECT_URI,
            "scope": " ".join(self.scopes),
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        }
        return f"{AUTH_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str, state: str | None = None) -> TokenBundle:
        # State-bound PKCE verifier is required by X's OAuth 2.0 flow.
        verifier = _pkce_verifiers.pop(state, None) if state else None
        if not verifier:
            raise RuntimeError("PKCE verifier missing — OAuth state not linked to this flow")

        basic = base64.b64encode(
            f"{settings.X_CLIENT_ID}:{settings.X_CLIENT_SECRET}".encode()
        ).decode()
        async with httpx.AsyncClient(timeout=20.0) as client:
            tok = await client.post(
                TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": settings.X_REDIRECT_URI,
                    "code_verifier": verifier,
                    "client_id": settings.X_CLIENT_ID,
                },
                headers={
                    "Authorization": f"Basic {basic}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
            tok.raise_for_status()
            td = tok.json()
            access_token = td["access_token"]
            refresh_token = td.get("refresh_token")
            expires_in = td.get("expires_in")

            me = await client.get(
                ME_URL, headers={"Authorization": f"Bearer {access_token}"}
            )
            me.raise_for_status()
            user = me.json().get("data", {})

        user_id = str(user.get("id") or "")
        username = user.get("username") or user_id or "x-user"
        if not user_id:
            raise RuntimeError("X /users/me returned no id")

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
                "platform": SocialPlatform.twitter,
                "account_id": user_id,
                "name": f"@{username}",
                "access_token": access_token,
            }],
        )

    async def refresh(self, account: SocialAccount) -> TokenBundle | None:
        return None  # refresh_token not persisted yet

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=20))
    async def publish(
        self,
        account: SocialAccount,
        content: str,
        media_urls: list[str],
    ) -> PublishResult:
        token = get_access_token(account) or ""
        headers = {"Authorization": f"Bearer {token}"}

        body: dict = {"text": content[:280]}
        media_ids: list[str] = []

        if media_urls:
            async with httpx.AsyncClient(timeout=60.0) as client:
                for url in media_urls[:4]:  # X allows up to 4 images
                    img = await client.get(url)
                    img.raise_for_status()
                    up = await client.post(
                        MEDIA_UPLOAD_URL,
                        headers=headers,
                        files={"media": img.content},
                    )
                    if up.status_code < 400:
                        mid = up.json().get("media_id_string")
                        if mid:
                            media_ids.append(mid)
            if media_ids:
                body["media"] = {"media_ids": media_ids}

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                TWEETS_URL,
                headers={**headers, "Content-Type": "application/json"},
                content=json.dumps(body),
            )
            resp.raise_for_status()
            data = resp.json().get("data", {})

        tweet_id = str(data.get("id") or "")
        return PublishResult(
            external_id=tweet_id,
            url=f"https://x.com/i/status/{tweet_id}" if tweet_id else None,
        )
