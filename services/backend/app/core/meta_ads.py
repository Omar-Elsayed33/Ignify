"""Meta Marketing API client wrapper.

Thin async wrapper around Facebook Graph API v19.0 for Ads management.
When META_APP_ID/META_APP_SECRET are unset OR the provided token is empty,
helpers degrade to stubbed responses so local dev works without real creds.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings

log = logging.getLogger(__name__)

BASE = "https://graph.facebook.com/v19.0"


def _is_stub(token: Optional[str]) -> bool:
    """When true, skip the real HTTP call and return deterministic stub data."""
    if not settings.META_APP_ID or not settings.META_APP_SECRET:
        return True
    if not token:
        return True
    return False


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def _request(
    method: str,
    path: str,
    token: str,
    *,
    params: Optional[dict[str, Any]] = None,
    data: Optional[dict[str, Any]] = None,
    files: Optional[dict[str, Any]] = None,
) -> dict:
    params = dict(params or {})
    params["access_token"] = token
    async with httpx.AsyncClient(timeout=30.0) as c:
        resp = await c.request(
            method,
            f"{BASE}{path}",
            params=params,
            data=data,
            files=files,
        )
        if resp.status_code >= 400:
            log.warning("meta_ads %s %s -> %s %s", method, path, resp.status_code, resp.text[:400])
            resp.raise_for_status()
        return resp.json()


# ──────────────────────────── Ad Accounts ────────────────────────────


async def list_ad_accounts(token: str) -> list[dict]:
    if _is_stub(token):
        return [
            {
                "id": "act_stub_1",
                "account_id": "stub_1",
                "name": "Stub Ad Account",
                "account_status": 1,
                "currency": "USD",
                "timezone_name": "America/Los_Angeles",
                "business": {"id": "biz_stub", "name": "Stub Business"},
            }
        ]
    data = await _request(
        "GET",
        "/me/adaccounts",
        token,
        params={"fields": "id,account_id,name,account_status,currency,timezone_name,business"},
    )
    return data.get("data", [])


# ──────────────────────────── Campaigns ────────────────────────────


async def create_campaign(
    account_id: str,
    token: str,
    *,
    name: str,
    objective: str,
    daily_budget_cents: int,
    special_categories: Optional[list[str]] = None,
) -> dict:
    if _is_stub(token):
        return {"id": f"stub_campaign_{name.lower().replace(' ', '_')[:20]}"}
    return await _request(
        "POST",
        f"/{account_id}/campaigns",
        token,
        data={
            "name": name,
            "objective": objective,
            "status": "PAUSED",
            "daily_budget": str(daily_budget_cents),
            "special_ad_categories": json.dumps(special_categories or []),
        },
    )


async def update_campaign_status(campaign_id: str, token: str, status: str) -> dict:
    if _is_stub(token) or campaign_id.startswith("stub_"):
        return {"success": True, "id": campaign_id, "status": status}
    return await _request("POST", f"/{campaign_id}", token, data={"status": status})


async def get_campaign_insights(
    campaign_id: str, token: str, date_preset: str = "last_7d"
) -> dict:
    if _is_stub(token) or campaign_id.startswith("stub_"):
        return {
            "data": [
                {
                    "impressions": "12000",
                    "clicks": "340",
                    "spend": "48.50",
                    "ctr": "2.83",
                    "cpc": "0.14",
                    "cpm": "4.04",
                    "reach": "8500",
                    "frequency": "1.41",
                    "actions": [{"action_type": "link_click", "value": "340"}],
                }
            ]
        }
    return await _request(
        "GET",
        f"/{campaign_id}/insights",
        token,
        params={
            "fields": "impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,actions",
            "date_preset": date_preset,
        },
    )


# ──────────────────────────── Ad Sets ────────────────────────────


async def create_adset(
    account_id: str,
    token: str,
    *,
    campaign_id: str,
    name: str,
    targeting: dict,
    daily_budget_cents: int,
    billing_event: str = "IMPRESSIONS",
    optimization_goal: str = "REACH",
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
) -> dict:
    if _is_stub(token):
        return {"id": f"stub_adset_{name.lower().replace(' ', '_')[:20]}"}
    payload: dict[str, Any] = {
        "name": name,
        "campaign_id": campaign_id,
        "targeting": json.dumps(targeting),
        "daily_budget": str(daily_budget_cents),
        "billing_event": billing_event,
        "optimization_goal": optimization_goal,
        "status": "PAUSED",
    }
    if start_time:
        payload["start_time"] = start_time
    if end_time:
        payload["end_time"] = end_time
    return await _request("POST", f"/{account_id}/adsets", token, data=payload)


# ──────────────────────────── Creatives & Ads ────────────────────────────


async def create_ad_creative(
    account_id: str,
    token: str,
    *,
    name: str,
    page_id: str,
    link: str,
    message: str,
    image_hash: Optional[str] = None,
) -> dict:
    if _is_stub(token):
        return {"id": f"stub_creative_{name.lower().replace(' ', '_')[:20]}"}
    link_data: dict[str, Any] = {"link": link, "message": message}
    if image_hash:
        link_data["image_hash"] = image_hash
    object_story_spec = {"page_id": page_id, "link_data": link_data}
    return await _request(
        "POST",
        f"/{account_id}/adcreatives",
        token,
        data={"name": name, "object_story_spec": json.dumps(object_story_spec)},
    )


async def create_ad(
    account_id: str,
    token: str,
    *,
    name: str,
    adset_id: str,
    creative_id: str,
) -> dict:
    if _is_stub(token):
        return {"id": f"stub_ad_{name.lower().replace(' ', '_')[:20]}"}
    return await _request(
        "POST",
        f"/{account_id}/ads",
        token,
        data={
            "name": name,
            "adset_id": adset_id,
            "creative": json.dumps({"creative_id": creative_id}),
            "status": "PAUSED",
        },
    )


async def upload_image(account_id: str, token: str, image_url: str) -> str:
    """Upload an image to the ad account. Returns image_hash for creative use."""
    if _is_stub(token):
        return f"stub_hash_{abs(hash(image_url)) % 10_000_000}"
    async with httpx.AsyncClient(timeout=60.0) as c:
        img = await c.get(image_url)
        img.raise_for_status()
        files = {
            "filename": (
                "ad.jpg",
                img.content,
                img.headers.get("content-type", "image/jpeg"),
            )
        }
        data = await _request("POST", f"/{account_id}/adimages", token, files=files)
    images = data.get("images", {}) or {}
    first = next(iter(images.values()), {})
    return first.get("hash", "")
