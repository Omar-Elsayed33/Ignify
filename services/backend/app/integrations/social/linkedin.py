"""LinkedIn connector — Sign In with LinkedIn v2 + UGC Posts API.

We request the ``w_member_social`` scope so we can publish on behalf of the
member. Posting to Company Pages would additionally need ``w_organization_social``
and the page's URN — deferred to a follow-up.

Docs:
- OAuth: https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
- Profile (OpenID userinfo): https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
- UGC Posts: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/ugc-post-api
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

from .base import PublishResult, TokenBundle, get_access_token

AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization"
TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
USERINFO_URL = "https://api.linkedin.com/v2/userinfo"
UGC_POSTS_URL = "https://api.linkedin.com/v2/ugcPosts"
ASSETS_REGISTER_URL = "https://api.linkedin.com/v2/assets?action=registerUpload"


class LinkedInConnector:
    platform = SocialPlatform.linkedin
    scopes: ClassVar[list[str]] = ["openid", "profile", "email", "w_member_social"]
    requires_media = False
    supports_refresh = True

    def is_configured(self) -> bool:
        return bool(
            settings.LINKEDIN_CLIENT_ID and settings.LINKEDIN_CLIENT_SECRET
        )

    def build_auth_url(self, state: str) -> str:
        params = {
            "response_type": "code",
            "client_id": settings.LINKEDIN_CLIENT_ID,
            "redirect_uri": settings.LINKEDIN_REDIRECT_URI,
            "state": state,
            "scope": " ".join(self.scopes),
        }
        return f"{AUTH_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str) -> TokenBundle:
        async with httpx.AsyncClient(timeout=20.0) as client:
            tok = await client.post(
                TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": settings.LINKEDIN_REDIRECT_URI,
                    "client_id": settings.LINKEDIN_CLIENT_ID,
                    "client_secret": settings.LINKEDIN_CLIENT_SECRET,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            tok.raise_for_status()
            td = tok.json()
            access_token = td["access_token"]
            refresh_token = td.get("refresh_token")
            expires_in = td.get("expires_in")  # seconds (typically 60 days)

            # Fetch profile for the member URN + display name
            info = await client.get(
                USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            info.raise_for_status()
            profile = info.json()

        member_id = profile.get("sub")  # e.g. "abc123XYZ"
        name = profile.get("name") or profile.get("email") or (member_id or "LinkedIn user")
        if not member_id:
            raise RuntimeError("LinkedIn userinfo missing 'sub' — cannot resolve member URN")

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
                "platform": SocialPlatform.linkedin,
                "account_id": member_id,  # store the *raw* sub; we URN-wrap at publish time
                "name": name,
                "access_token": access_token,
            }],
        )

    async def refresh(self, account: SocialAccount) -> TokenBundle | None:
        # We don't currently persist refresh_token (no column yet); return None.
        # TODO once migration adds refresh_token: POST grant_type=refresh_token.
        return None

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=20))
    async def publish(
        self,
        account: SocialAccount,
        content: str,
        media_urls: list[str],
    ) -> PublishResult:
        token = get_access_token(account) or ""
        author = f"urn:li:person:{account.account_id}"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            media_assets: list[dict] = []
            if media_urls:
                # Register + upload each image. LinkedIn wants the asset URN back.
                for url in media_urls[:9]:  # LinkedIn cap
                    asset_urn = await _upload_image(client, headers, author, url)
                    if asset_urn:
                        media_assets.append({
                            "status": "READY",
                            "media": asset_urn,
                        })

            specific = {
                "shareCommentary": {"text": content},
                "shareMediaCategory": "IMAGE" if media_assets else "NONE",
            }
            if media_assets:
                specific["media"] = media_assets

            body = {
                "author": author,
                "lifecycleState": "PUBLISHED",
                "specificContent": {
                    "com.linkedin.ugc.ShareContent": specific,
                },
                "visibility": {
                    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
                },
            }
            resp = await client.post(UGC_POSTS_URL, headers=headers, content=json.dumps(body))
            resp.raise_for_status()
            # LinkedIn returns the URN in the X-RestLi-Id header *or* body id.
            post_urn = resp.headers.get("x-restli-id") or resp.json().get("id") or ""

        return PublishResult(
            external_id=str(post_urn),
            url=f"https://www.linkedin.com/feed/update/{post_urn}/" if post_urn else None,
        )


async def _upload_image(
    client: httpx.AsyncClient,
    headers: dict,
    author: str,
    source_url: str,
) -> str | None:
    """Register an upload slot, PUT the image bytes, return the asset URN."""
    register_body = {
        "registerUploadRequest": {
            "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
            "owner": author,
            "serviceRelationships": [{
                "relationshipType": "OWNER",
                "identifier": "urn:li:userGeneratedContent",
            }],
        }
    }
    reg = await client.post(
        ASSETS_REGISTER_URL,
        headers={**headers, "Content-Type": "application/json"},
        content=json.dumps(register_body),
    )
    reg.raise_for_status()
    rd = reg.json().get("value", {})
    asset_urn = rd.get("asset")
    upload_url = (
        rd.get("uploadMechanism", {})
          .get("com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest", {})
          .get("uploadUrl")
    )
    if not asset_urn or not upload_url:
        return None

    # Fetch the image bytes from the caller-supplied URL
    img = await client.get(source_url, timeout=30.0)
    img.raise_for_status()

    put = await client.put(
        upload_url,
        headers={"Authorization": headers["Authorization"]},
        content=img.content,
    )
    put.raise_for_status()
    return asset_urn
