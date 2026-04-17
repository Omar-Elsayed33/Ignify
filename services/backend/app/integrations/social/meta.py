"""Meta connector — covers both Facebook Pages and Instagram Business accounts.

One OAuth dance returns pages; each page may also expose a linked IG Business
user. We therefore persist *two* `SocialAccount` rows per page when IG is
linked — one per platform.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import ClassVar
from urllib.parse import urlencode

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.db.models import SocialAccount, SocialPlatform

from .base import PublishResult, TokenBundle

GRAPH = "https://graph.facebook.com/v19.0"
META_SCOPES: ClassVar[list[str]] = [
    "pages_show_list",
    "pages_manage_posts",
    "pages_read_engagement",
    "instagram_basic",
    "instagram_content_publish",
    "ads_management",
    "ads_read",
    "business_management",
]


class _MetaBase:
    scopes = META_SCOPES
    supports_refresh = False

    def is_configured(self) -> bool:
        return bool(settings.META_APP_ID and settings.META_APP_SECRET)

    def build_auth_url(self, state: str) -> str:
        params = {
            "client_id": settings.META_APP_ID,
            "redirect_uri": settings.META_REDIRECT_URI,
            "state": state,
            "scope": ",".join(META_SCOPES),
            "response_type": "code",
        }
        return f"https://www.facebook.com/v19.0/dialog/oauth?{urlencode(params)}"

    async def exchange_code(self, code: str) -> TokenBundle:
        async with httpx.AsyncClient(timeout=20.0) as client:
            short = await client.get(
                f"{GRAPH}/oauth/access_token",
                params={
                    "client_id": settings.META_APP_ID,
                    "client_secret": settings.META_APP_SECRET,
                    "redirect_uri": settings.META_REDIRECT_URI,
                    "code": code,
                },
            )
            short.raise_for_status()
            short_token = short.json().get("access_token")

            long = await client.get(
                f"{GRAPH}/oauth/access_token",
                params={
                    "grant_type": "fb_exchange_token",
                    "client_id": settings.META_APP_ID,
                    "client_secret": settings.META_APP_SECRET,
                    "fb_exchange_token": short_token,
                },
            )
            long.raise_for_status()
            long_data = long.json()
            long_token = long_data.get("access_token")
            expires_in = long_data.get("expires_in")

            pages_resp = await client.get(
                f"{GRAPH}/me/accounts",
                params={
                    "access_token": long_token,
                    "fields": "id,name,access_token,instagram_business_account",
                },
            )
            pages_resp.raise_for_status()
            pages = pages_resp.json().get("data", [])

        expires_at = (
            datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))
            if expires_in
            else None
        )

        accounts: list[dict] = []
        for page in pages:
            page_id = page["id"]
            page_name = page.get("name") or page_id
            page_token = page.get("access_token") or long_token
            accounts.append({
                "platform": SocialPlatform.facebook,
                "account_id": page_id,
                "name": page_name,
                "access_token": page_token,
            })
            ig = page.get("instagram_business_account") or {}
            ig_id = ig.get("id")
            if ig_id:
                accounts.append({
                    "platform": SocialPlatform.instagram,
                    "account_id": ig_id,
                    "name": f"{page_name} (IG)",
                    "access_token": page_token,
                })

        return TokenBundle(
            access_token=long_token or "",
            expires_at=expires_at,
            accounts=accounts,
        )

    async def refresh(self, account: SocialAccount) -> TokenBundle | None:
        # Long-lived page tokens don't expire while the user is active; skip refresh.
        return None


class FacebookConnector(_MetaBase):
    platform = SocialPlatform.facebook
    requires_media = False

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=20))
    async def publish(
        self,
        account: SocialAccount,
        content: str,
        media_urls: list[str],
    ) -> PublishResult:
        token = account.access_token_encrypted or ""
        async with httpx.AsyncClient(timeout=30.0) as client:
            if media_urls:
                resp = await client.post(
                    f"{GRAPH}/{account.account_id}/photos",
                    data={"url": media_urls[0], "caption": content, "access_token": token},
                )
            else:
                resp = await client.post(
                    f"{GRAPH}/{account.account_id}/feed",
                    data={"message": content, "access_token": token},
                )
            resp.raise_for_status()
            data = resp.json()
        external_id = str(data.get("id") or data.get("post_id") or "")
        return PublishResult(external_id=external_id)


class InstagramConnector(_MetaBase):
    platform = SocialPlatform.instagram
    requires_media = True

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=20))
    async def publish(
        self,
        account: SocialAccount,
        content: str,
        media_urls: list[str],
    ) -> PublishResult:
        if not media_urls:
            raise ValueError("Instagram posts require at least one media URL")
        token = account.access_token_encrypted or ""
        async with httpx.AsyncClient(timeout=30.0) as client:
            container = await client.post(
                f"{GRAPH}/{account.account_id}/media",
                data={"image_url": media_urls[0], "caption": content, "access_token": token},
            )
            container.raise_for_status()
            creation_id = container.json().get("id")
            publish = await client.post(
                f"{GRAPH}/{account.account_id}/media_publish",
                data={"creation_id": creation_id, "access_token": token},
            )
            publish.raise_for_status()
            external_id = str(publish.json().get("id") or "")
        return PublishResult(external_id=external_id)
