"""Geo/currency detection based on client IP or Cloudflare header."""
from __future__ import annotations

from fastapi import APIRouter, Request

import httpx

router = APIRouter(prefix="/geo", tags=["geo"])


COUNTRY_CURRENCY: dict[str, str] = {
    "EG": "EGP",
    "SA": "SAR",
    "AE": "AED",
    "KW": "AED",
    "QA": "AED",
    "BH": "AED",
    "OM": "AED",
}


def _is_private(ip: str) -> bool:
    return (
        not ip
        or ip.startswith("127.")
        or ip.startswith("10.")
        or ip.startswith("192.168.")
        or ip.startswith("172.")
        or ip == "localhost"
        or ip == "::1"
    )


@router.get("/detect")
async def detect(request: Request):
    """Detect user country and preferred currency.

    Order of resolution:
      1. Cloudflare ``CF-IPCountry`` header (free on CF edge).
      2. IP geolocation via ``ipapi.co`` (best-effort, 3s timeout).
      3. Fallback to ``US`` / ``USD``.

    No auth; lightweight. Response is intentionally short and cacheable.
    """
    country = (request.headers.get("cf-ipcountry") or "").strip().upper()

    if not country:
        fwd = request.headers.get("x-forwarded-for", "")
        ip = fwd.split(",")[0].strip() if fwd else ""
        if not ip and request.client:
            ip = request.client.host or ""

        if ip and not _is_private(ip):
            try:
                async with httpx.AsyncClient(timeout=3.0) as client:
                    resp = await client.get(f"https://ipapi.co/{ip}/country/")
                    if resp.status_code == 200:
                        text = (resp.text or "").strip()
                        if len(text) == 2 and text.isalpha():
                            country = text.upper()
            except Exception:
                pass

    country = country or "US"
    currency = COUNTRY_CURRENCY.get(country, "USD")
    return {"country": country, "currency": currency}
