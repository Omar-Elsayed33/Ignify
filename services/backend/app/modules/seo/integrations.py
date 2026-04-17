"""Google OAuth + Search Console + Analytics 4 integration.

Storage: `tenant.config.google_integrations.{search_console, analytics}` holds
tokens + site_url/property_id + last_sync + sync_data (short cache of latest pull).

State is passed through Google OAuth `state` param as a short random token
mapped in-memory to (tenant_id, service). Like the Meta OAuth flow.

No google-* python lib: plain httpx HTTP calls.
"""
from __future__ import annotations

import logging
import secrets
import time
import uuid
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.core.config import settings
from app.db.models import Tenant

log = logging.getLogger(__name__)


# ─── Scopes ──────────────────────────────────────────────────────────────
# Search Console read-only + Analytics read-only + user profile.
GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/webmasters.readonly",
    "https://www.googleapis.com/auth/analytics.readonly",
    "openid",
    "email",
]

SERVICE_SEARCH_CONSOLE = "search_console"
SERVICE_ANALYTICS = "analytics"
VALID_SERVICES = {SERVICE_SEARCH_CONSOLE, SERVICE_ANALYTICS}


# ─── In-memory OAuth state ───────────────────────────────────────────────
# state_token -> (tenant_id, service, expires_epoch)
_STATE_STORE: dict[str, tuple[str, str, float]] = {}
_STATE_TTL_SECONDS = 600


def _put_state(tenant_id: uuid.UUID, service: str) -> str:
    token = secrets.token_urlsafe(24)
    _STATE_STORE[token] = (str(tenant_id), service, time.time() + _STATE_TTL_SECONDS)
    # Opportunistic cleanup
    now = time.time()
    for k in [k for k, v in _STATE_STORE.items() if v[2] < now]:
        _STATE_STORE.pop(k, None)
    return token


def _pop_state(token: str) -> tuple[str, str] | None:
    bound = _STATE_STORE.pop(token, None)
    if not bound:
        return None
    tenant_id, service, expires = bound
    if expires < time.time():
        return None
    return tenant_id, service


# ─── Config + helpers ────────────────────────────────────────────────────


def oauth_configured() -> bool:
    return bool(settings.GOOGLE_OAUTH_CLIENT_ID and settings.GOOGLE_OAUTH_CLIENT_SECRET)


async def _get_tenant(db: AsyncSession, tenant_id: uuid.UUID) -> Tenant:
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    return result.scalar_one()


def _cfg(tenant: Tenant) -> dict:
    cfg = deepcopy(tenant.config or {})
    cfg.setdefault("google_integrations", {})
    cfg["google_integrations"].setdefault(SERVICE_SEARCH_CONSOLE, {})
    cfg["google_integrations"].setdefault(SERVICE_ANALYTICS, {})
    return cfg


async def _save_cfg(db: AsyncSession, tenant: Tenant, cfg: dict) -> None:
    tenant.config = cfg
    flag_modified(tenant, "config")
    await db.flush()


# ─── OAuth flow ──────────────────────────────────────────────────────────


def build_auth_url(tenant_id: uuid.UUID, service: str) -> str:
    if service not in VALID_SERVICES:
        raise ValueError(f"Unknown service: {service}")
    if not oauth_configured():
        raise RuntimeError("Google OAuth not configured (missing client id/secret).")
    state = _put_state(tenant_id, service)
    params = {
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(GOOGLE_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)


async def exchange_code(
    db: AsyncSession, code: str, state: str
) -> tuple[uuid.UUID, str]:
    """Exchange an OAuth code for tokens, then store them on the tenant.
    Returns (tenant_id, service)."""
    bound = _pop_state(state)
    if not bound:
        raise ValueError("Invalid or expired OAuth state")
    tenant_id_str, service = bound
    tenant_id = uuid.UUID(tenant_id_str)

    async with httpx.AsyncClient(timeout=30.0) as c:
        resp = await c.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
                "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        resp.raise_for_status()
        tokens = resp.json()

    tenant = await _get_tenant(db, tenant_id)
    cfg = _cfg(tenant)
    entry = cfg["google_integrations"][service]
    entry["access_token"] = tokens.get("access_token")
    entry["refresh_token"] = tokens.get("refresh_token") or entry.get("refresh_token")
    entry["scope"] = tokens.get("scope")
    entry["token_type"] = tokens.get("token_type", "Bearer")
    expires_in = int(tokens.get("expires_in") or 0)
    entry["expires_at"] = (
        datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    ).isoformat() if expires_in else None
    entry["connected_at"] = datetime.now(timezone.utc).isoformat()

    await _save_cfg(db, tenant, cfg)
    return tenant_id, service


async def refresh_access_token(
    db: AsyncSession, tenant_id: uuid.UUID, service: str
) -> str | None:
    """Refresh the access token using the stored refresh_token. Returns the
    new access token on success, or None if we can't refresh."""
    tenant = await _get_tenant(db, tenant_id)
    cfg = _cfg(tenant)
    entry = cfg["google_integrations"].get(service) or {}
    refresh_token = entry.get("refresh_token")
    if not refresh_token or not oauth_configured():
        return None

    async with httpx.AsyncClient(timeout=30.0) as c:
        try:
            resp = await c.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "refresh_token": refresh_token,
                    "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
                    "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
                    "grant_type": "refresh_token",
                },
            )
            resp.raise_for_status()
        except Exception as e:
            log.warning("refresh_access_token failed: %s", e)
            return None
        tokens = resp.json()

    entry["access_token"] = tokens.get("access_token")
    expires_in = int(tokens.get("expires_in") or 0)
    entry["expires_at"] = (
        datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    ).isoformat() if expires_in else None
    await _save_cfg(db, tenant, cfg)
    return entry["access_token"]


async def get_valid_token(
    db: AsyncSession, tenant_id: uuid.UUID, service: str
) -> str | None:
    """Return an access token, refreshing it if expired. None if not connected."""
    tenant = await _get_tenant(db, tenant_id)
    cfg = _cfg(tenant)
    entry = cfg["google_integrations"].get(service) or {}
    token = entry.get("access_token")
    if not token:
        return None
    expires_at = entry.get("expires_at")
    needs_refresh = False
    if expires_at:
        try:
            exp = datetime.fromisoformat(expires_at)
            if exp <= datetime.now(timezone.utc) + timedelta(seconds=60):
                needs_refresh = True
        except ValueError:
            needs_refresh = True
    if needs_refresh:
        new_token = await refresh_access_token(db, tenant_id, service)
        return new_token or token
    return token


async def disconnect(db: AsyncSession, tenant_id: uuid.UUID, service: str) -> None:
    tenant = await _get_tenant(db, tenant_id)
    cfg = _cfg(tenant)
    cfg["google_integrations"][service] = {}
    await _save_cfg(db, tenant, cfg)


# ─── Status snapshot ─────────────────────────────────────────────────────


async def status_snapshot(
    db: AsyncSession, tenant_id: uuid.UUID
) -> dict[str, Any]:
    tenant = await _get_tenant(db, tenant_id)
    gi = (tenant.config or {}).get("google_integrations") or {}
    sc = gi.get(SERVICE_SEARCH_CONSOLE) or {}
    ga = gi.get(SERVICE_ANALYTICS) or {}
    return {
        "oauth_configured": oauth_configured(),
        "search_console": {
            "connected": bool(sc.get("access_token")),
            "site_url": sc.get("site_url"),
            "last_sync": sc.get("last_sync"),
            "data": sc.get("sync_data"),
        },
        "analytics": {
            "connected": bool(ga.get("access_token")),
            "property_id": ga.get("property_id"),
            "last_sync": ga.get("last_sync"),
            "data": ga.get("sync_data"),
        },
        "setup_note": (
            "Connect via Google OAuth to see real Search Console impressions/clicks "
            "and Analytics visitor data."
        ),
    }


# ─── Search Console: list sites + sync queries ────────────────────────────


async def sc_list_sites(db: AsyncSession, tenant_id: uuid.UUID) -> list[dict]:
    token = await get_valid_token(db, tenant_id, SERVICE_SEARCH_CONSOLE)
    if not token:
        return []
    async with httpx.AsyncClient(timeout=30.0) as c:
        resp = await c.get(
            "https://www.googleapis.com/webmasters/v3/sites",
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        return resp.json().get("siteEntry", []) or []


async def sc_set_site(
    db: AsyncSession, tenant_id: uuid.UUID, site_url: str
) -> None:
    tenant = await _get_tenant(db, tenant_id)
    cfg = _cfg(tenant)
    cfg["google_integrations"][SERVICE_SEARCH_CONSOLE]["site_url"] = site_url
    await _save_cfg(db, tenant, cfg)


async def sc_sync(
    db: AsyncSession, tenant_id: uuid.UUID, days: int = 28
) -> dict[str, Any]:
    """Pull top 20 queries + top 20 pages for the last N days."""
    token = await get_valid_token(db, tenant_id, SERVICE_SEARCH_CONSOLE)
    if not token:
        raise ValueError("Search Console not connected")
    tenant = await _get_tenant(db, tenant_id)
    cfg = _cfg(tenant)
    entry = cfg["google_integrations"][SERVICE_SEARCH_CONSOLE]
    site_url = entry.get("site_url")
    if not site_url:
        raise ValueError("No site selected — call sc_set_site first")

    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=days)

    body_queries = {
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "dimensions": ["query"],
        "rowLimit": 20,
    }
    body_pages = {
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "dimensions": ["page"],
        "rowLimit": 20,
    }

    from urllib.parse import quote
    url = (
        f"https://www.googleapis.com/webmasters/v3/sites/{quote(site_url, safe='')}"
        f"/searchAnalytics/query"
    )

    async with httpx.AsyncClient(timeout=60.0) as c:
        q_resp = await c.post(
            url,
            headers={"Authorization": f"Bearer {token}"},
            json=body_queries,
        )
        q_resp.raise_for_status()
        p_resp = await c.post(
            url,
            headers={"Authorization": f"Bearer {token}"},
            json=body_pages,
        )
        p_resp.raise_for_status()

    def _row_to_dict(r: dict, key: str) -> dict:
        return {
            key: (r.get("keys") or [""])[0],
            "clicks": r.get("clicks", 0),
            "impressions": r.get("impressions", 0),
            "ctr": round((r.get("ctr") or 0) * 100, 2),
            "position": round(r.get("position") or 0, 1),
        }

    data = {
        "period_days": days,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "top_queries": [_row_to_dict(r, "query") for r in (q_resp.json().get("rows") or [])],
        "top_pages": [_row_to_dict(r, "page") for r in (p_resp.json().get("rows") or [])],
    }
    entry["sync_data"] = data
    entry["last_sync"] = datetime.now(timezone.utc).isoformat()
    await _save_cfg(db, tenant, cfg)
    return data


# ─── Analytics 4: list properties + sync traffic ──────────────────────────


async def ga_list_properties(db: AsyncSession, tenant_id: uuid.UUID) -> list[dict]:
    """List GA4 properties via Admin API."""
    token = await get_valid_token(db, tenant_id, SERVICE_ANALYTICS)
    if not token:
        return []
    out: list[dict] = []
    async with httpx.AsyncClient(timeout=30.0) as c:
        # 1) list accounts
        acc_resp = await c.get(
            "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
            headers={"Authorization": f"Bearer {token}"},
        )
        acc_resp.raise_for_status()
        summaries = acc_resp.json().get("accountSummaries") or []
        for acc in summaries:
            for p in acc.get("propertySummaries") or []:
                out.append({
                    "property_id": p.get("property", "").replace("properties/", ""),
                    "display_name": p.get("displayName"),
                    "account": acc.get("displayName"),
                })
    return out


async def ga_set_property(
    db: AsyncSession, tenant_id: uuid.UUID, property_id: str
) -> None:
    tenant = await _get_tenant(db, tenant_id)
    cfg = _cfg(tenant)
    cfg["google_integrations"][SERVICE_ANALYTICS]["property_id"] = property_id
    await _save_cfg(db, tenant, cfg)


async def ga_sync(
    db: AsyncSession, tenant_id: uuid.UUID, days: int = 28
) -> dict[str, Any]:
    """Pull GA4 basic metrics: sessions/users per day + top pages + traffic sources."""
    token = await get_valid_token(db, tenant_id, SERVICE_ANALYTICS)
    if not token:
        raise ValueError("Analytics not connected")
    tenant = await _get_tenant(db, tenant_id)
    cfg = _cfg(tenant)
    entry = cfg["google_integrations"][SERVICE_ANALYTICS]
    property_id = entry.get("property_id")
    if not property_id:
        raise ValueError("No GA4 property selected — call ga_set_property first")

    base_url = (
        f"https://analyticsdata.googleapis.com/v1beta/properties/{property_id}:runReport"
    )
    common_range = [{"startDate": f"{days}daysAgo", "endDate": "today"}]

    req_daily = {
        "dateRanges": common_range,
        "dimensions": [{"name": "date"}],
        "metrics": [
            {"name": "activeUsers"},
            {"name": "sessions"},
        ],
        "orderBys": [{"dimension": {"dimensionName": "date"}}],
    }
    req_top_pages = {
        "dateRanges": common_range,
        "dimensions": [{"name": "pagePath"}],
        "metrics": [{"name": "screenPageViews"}, {"name": "activeUsers"}],
        "orderBys": [{"metric": {"metricName": "screenPageViews"}, "desc": True}],
        "limit": 10,
    }
    req_sources = {
        "dateRanges": common_range,
        "dimensions": [{"name": "sessionDefaultChannelGroup"}],
        "metrics": [{"name": "sessions"}, {"name": "activeUsers"}],
        "orderBys": [{"metric": {"metricName": "sessions"}, "desc": True}],
    }

    async with httpx.AsyncClient(timeout=60.0) as c:
        headers = {"Authorization": f"Bearer {token}"}
        daily = (await c.post(base_url, headers=headers, json=req_daily)).json()
        pages = (await c.post(base_url, headers=headers, json=req_top_pages)).json()
        sources = (await c.post(base_url, headers=headers, json=req_sources)).json()

    def _rows(report: dict, dim_key: str, metrics: list[str]) -> list[dict]:
        out: list[dict] = []
        for row in report.get("rows") or []:
            dims = [d.get("value", "") for d in row.get("dimensionValues") or []]
            vals = [v.get("value", "0") for v in row.get("metricValues") or []]
            item: dict[str, Any] = {dim_key: dims[0] if dims else ""}
            for i, m in enumerate(metrics):
                try:
                    item[m] = int(vals[i]) if i < len(vals) else 0
                except (TypeError, ValueError):
                    item[m] = vals[i] if i < len(vals) else "0"
            out.append(item)
        return out

    data = {
        "period_days": days,
        "daily": _rows(daily, "date", ["activeUsers", "sessions"]),
        "top_pages": _rows(pages, "page", ["screenPageViews", "activeUsers"]),
        "traffic_sources": _rows(sources, "channel", ["sessions", "activeUsers"]),
    }
    entry["sync_data"] = data
    entry["last_sync"] = datetime.now(timezone.utc).isoformat()
    await _save_cfg(db, tenant, cfg)
    return data
