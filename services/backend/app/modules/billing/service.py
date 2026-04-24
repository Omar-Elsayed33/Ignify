"""Billing service: plans, subscriptions, checkout (Stripe + Paymob), usage/quota."""
from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import base64
import httpx
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.db.models import (
    ContentPost,
    CreativeAsset,
    Plan,
    Tenant,
)

# ── Plan catalog defaults ───────────────────────────────────────────────────

# Phase 6 P3: pricing restructured to be cost-defensible at scale.
#
# Key change: every tier now declares three things that actually cost us money:
#   - plans_per_month  → how many full strategy runs (14-agent pipeline)
#   - deep_plans_per_month → subset of plans_per_month that can use Deep mode
#   - ai_budget_usd    → hard dollar cap enforced by core.ai_budget.check()
#
# The dollar cap is what keeps a single tenant from running $590 of LLM spend
# against a $99 subscription. It's enforced server-side, independent of the
# per-resource quotas below.
#
# Sizing principle: ai_budget_usd ~ 20–25% of price_monthly (gross margin
# target ≥ 75% on AI cost alone, before other infra).
DEFAULT_PLANS: list[dict[str, Any]] = [
    {
        "code": "free",
        "slug": "free",
        "name_en": "Free",
        "name_ar": "مجاني",
        "price_usd": 0.0,
        "price_egp": 0.0,
        "price_monthly": 0.0,
        "max_users": 1,
        "max_channels": 1,
        "max_credits": 100,
        "features": ["basic_content", "1_channel"],
        "limits": {
            "plans": 1,              # one plan/month — just enough to evaluate
            "deep_plans": 0,         # no Deep mode on Free — too expensive
            "articles": 5,
            "images": 10,
            "videos": 0,             # video gen disabled platform-wide
            "ai_tokens": 50_000,
            "ai_budget_usd": 0.50,   # caps LLM spend; Fast plan ~$0.01 × ~30
        },
        "plan_modes_allowed": ["fast"],
        "coming_soon": [],
        "popular": False,
    },
    {
        "code": "starter",
        "slug": "starter",
        "name_en": "Starter",
        "name_ar": "المبتدئ",
        "price_usd": 29.0,
        "price_egp": 1499.0,
        "price_monthly": 29.0,
        "max_users": 3,
        "max_channels": 3,
        "max_credits": 1000,
        "features": ["basic_content", "ai_creative", "social_scheduler", "3_channels"],
        "limits": {
            "plans": 5,
            "deep_plans": 0,         # Starter stays Fast + Medium only
            "articles": 30,
            "images": 100,
            "videos": 0,
            "ai_tokens": 500_000,
            "ai_budget_usd": 6.00,   # ~20% of $29 — covers ~15 Medium + buffer
        },
        "plan_modes_allowed": ["fast", "medium"],
        "coming_soon": [],
        "popular": False,
    },
    {
        "code": "growth",
        "slug": "growth",
        "name_en": "Growth",
        "name_ar": "النمو",
        "price_usd": 59.0,
        "price_egp": 2999.0,
        "price_monthly": 59.0,
        "max_users": 5,
        "max_channels": 5,
        "max_credits": 2500,
        "features": ["basic_content", "ai_creative", "social_scheduler", "seo", "analytics", "5_channels"],
        "limits": {
            "plans": 10,
            "deep_plans": 3,         # first tier with Deep access — limited
            "articles": 75,
            "images": 250,
            "videos": 0,
            "ai_tokens": 1_500_000,
            "ai_budget_usd": 12.00,  # ~20% of $59 — covers 3 Deep + plenty of Medium
        },
        "plan_modes_allowed": ["fast", "medium", "deep"],
        "coming_soon": [],
        "popular": False,
    },
    {
        "code": "pro",
        "slug": "pro",
        "name_en": "Pro",
        "name_ar": "احترافي",
        "price_usd": 99.0,
        "price_egp": 4999.0,
        "price_monthly": 99.0,
        "max_users": 10,
        "max_channels": 10,
        "max_credits": 5000,
        "features": [
            "basic_content",
            "ai_creative",
            "social_scheduler",
            "campaigns",
            "analytics",
            "seo",
            "10_channels",
        ],
        "limits": {
            "plans": 25,
            "deep_plans": 8,
            "articles": 150,
            "images": 500,
            "videos": 0,
            "ai_tokens": 3_000_000,
            "ai_budget_usd": 22.00,  # ~22% of $99 — matches DEEP_MODE_MONTHLY_CAP spend
        },
        "plan_modes_allowed": ["fast", "medium", "deep"],
        "coming_soon": ["ai_video"],
        "popular": True,
    },
    {
        "code": "agency",
        "slug": "agency",
        "name_en": "Agency",
        "name_ar": "الوكالة",
        "price_usd": 299.0,
        "price_egp": 14999.0,
        "price_monthly": 299.0,
        "max_users": 50,
        "max_channels": 50,
        "max_credits": 25000,
        "features": [
            "basic_content",
            "ai_creative",
            "social_scheduler",
            "campaigns",
            "analytics",
            "seo",
            "white_label",
            "priority_support",
            "unlimited_channels",
        ],
        "limits": {
            "plans": 100,
            "deep_plans": 25,
            "articles": -1,           # unlimited
            "images": -1,
            "videos": 0,
            "ai_tokens": 20_000_000,
            "ai_budget_usd": 70.00,   # ~23% of $299 — supports agency resellers
        },
        "plan_modes_allowed": ["fast", "medium", "deep"],
        "coming_soon": ["ai_video"],
        "popular": False,
    },
]


# ── Helpers ─────────────────────────────────────────────────────────────────


def _plan_meta(plan: Plan) -> dict[str, Any]:
    """Extract Ignify-specific metadata from Plan.features JSON blob.

    The existing Plan.features column is a JSON dict. We store:
      {
        "code": "pro",
        "name_en": "...", "name_ar": "...",
        "price_usd": 99, "price_egp": 4999,
        "features": [...],   # feature flags list
        "limits": {...},
        "popular": true|false
      }
    """
    f = plan.features or {}
    if isinstance(f, list):
        # legacy list — wrap
        return {"features": f, "limits": {}, "code": plan.slug}
    return f


_FX_FROM_USD: dict[str, float] = {
    "USD": 1.0,
    "EGP": 50.0,
    "SAR": 3.75,
    "AED": 3.67,
}


def _row_to_plan_item(plan: Plan, currency: Optional[str] = None) -> dict[str, Any]:
    meta = _plan_meta(plan)
    usd = float(meta.get("price_usd", plan.price_monthly or 0))
    egp = float(meta.get("price_egp", (plan.price_monthly or 0) * 50))

    prices: dict[str, Any] = dict(getattr(plan, "prices", None) or {})
    if not prices:
        # synthesize from legacy columns
        monthly_usd = usd
        yearly_usd = round(monthly_usd * 10, 2)
        prices = {
            cur: {
                "monthly": round(monthly_usd * rate, 2),
                "yearly": round(yearly_usd * rate, 2),
            }
            for cur, rate in _FX_FROM_USD.items()
        }

    localized: dict[str, float] = {}
    cur_code: Optional[str] = None
    if currency:
        cur_code = currency.upper()
        entry = prices.get(cur_code) or {}
        if not entry:
            rate = _FX_FROM_USD.get(cur_code, 1.0)
            monthly = round(usd * rate, 2)
            entry = {"monthly": monthly, "yearly": round(monthly * 10, 2)}
        localized = {
            "monthly": float(entry.get("monthly", 0) or 0),
            "yearly": float(entry.get("yearly", 0) or 0),
        }

    return {
        "id": plan.id,
        "code": meta.get("code", plan.slug),
        "name_en": meta.get("name_en", plan.name),
        "name_ar": meta.get("name_ar", plan.name),
        "price_usd": usd,
        "price_egp": egp,
        "prices": prices,
        "price": localized,
        "currency": cur_code,
        "features": meta.get("features", []) or [],
        # Features that appear on pricing pages but aren't shipped yet.
        # Frontend should render these greyed out with a "Coming soon" tag
        # rather than listing them as active capabilities.
        "coming_soon": meta.get("coming_soon", []) or [],
        "limits": meta.get("limits", {}) or {},
        # Phase 6 P3: which plan-generation modes are allowed on this tier.
        # Frontend locks out Deep mode for Free/Starter, Medium+Deep for Free.
        "plan_modes_allowed": meta.get("plan_modes_allowed", ["fast", "medium", "deep"]),
        "popular": bool(meta.get("popular", False)),
        "is_active": bool(getattr(plan, "is_active", True)),
    }


def _default_prices_for(monthly_usd: float, monthly_egp: float | None = None) -> dict[str, dict[str, float]]:
    yearly_usd = round(monthly_usd * 10, 2)
    prices: dict[str, dict[str, float]] = {
        cur: {
            "monthly": round(monthly_usd * rate, 2),
            "yearly": round(yearly_usd * rate, 2),
        }
        for cur, rate in _FX_FROM_USD.items()
    }
    if monthly_egp is not None:
        prices["EGP"] = {
            "monthly": float(monthly_egp),
            "yearly": round(float(monthly_egp) * 10, 2),
        }
    return prices


async def _seed_default_plans(db: AsyncSession) -> None:
    """Ensure default plans exist. Safe to call repeatedly."""
    for p in DEFAULT_PLANS:
        existing = (
            await db.execute(select(Plan).where(Plan.slug == p["slug"]))
        ).scalar_one_or_none()
        features_blob = {
            "code": p["code"],
            "name_en": p["name_en"],
            "name_ar": p["name_ar"],
            "price_usd": p["price_usd"],
            "price_egp": p["price_egp"],
            "features": p["features"],
            "limits": p["limits"],
            "popular": p["popular"],
        }
        default_prices = _default_prices_for(
            float(p["price_monthly"]), float(p["price_egp"])
        )
        if existing is None:
            db.add(
                Plan(
                    name=p["name_en"],
                    slug=p["slug"],
                    max_users=p["max_users"],
                    max_channels=p["max_channels"],
                    max_credits=p["max_credits"],
                    price_monthly=p["price_monthly"],
                    features=features_blob,
                    prices=default_prices,
                    is_active=True,
                )
            )
        else:
            existing.features = features_blob
            existing.price_monthly = p["price_monthly"]
            existing.max_users = p["max_users"]
            existing.max_channels = p["max_channels"]
            existing.max_credits = p["max_credits"]
            if not getattr(existing, "prices", None):
                existing.prices = default_prices
    await db.flush()


# ── Public service API ──────────────────────────────────────────────────────


async def list_plans(
    db: AsyncSession, currency: Optional[str] = None, include_inactive: bool = False
) -> list[dict[str, Any]]:
    result = await db.execute(select(Plan))
    plans = result.scalars().all()
    if not plans:
        await _seed_default_plans(db)
        await db.commit()
        result = await db.execute(select(Plan))
        plans = result.scalars().all()
    items = [_row_to_plan_item(p, currency=currency) for p in plans]
    if not include_inactive:
        items = [i for i in items if i.get("is_active", True)]
    return items


async def get_plan_by_code(db: AsyncSession, code: str) -> Optional[Plan]:
    # code may match slug or features.code
    result = await db.execute(select(Plan).where(Plan.slug == code))
    plan = result.scalar_one_or_none()
    if plan:
        return plan
    # fallback: search all and match code inside features
    result = await db.execute(select(Plan))
    for p in result.scalars().all():
        if _plan_meta(p).get("code") == code:
            return p
    return None


async def get_subscription_status(
    db: AsyncSession, tenant_id: uuid.UUID
) -> dict[str, Any]:
    tenant = (
        await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    ).scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    cfg = tenant.config or {}
    billing = cfg.get("billing", {}) if isinstance(cfg, dict) else {}

    plan_code = None
    name_en = None
    name_ar = None
    if tenant.plan_id:
        plan = (
            await db.execute(select(Plan).where(Plan.id == tenant.plan_id))
        ).scalar_one_or_none()
        if plan:
            meta = _plan_meta(plan)
            plan_code = meta.get("code", plan.slug)
            name_en = meta.get("name_en", plan.name)
            name_ar = meta.get("name_ar", plan.name)

    period_end = billing.get("current_period_end")
    if isinstance(period_end, str):
        try:
            period_end = datetime.fromisoformat(period_end)
        except ValueError:
            period_end = None

    return {
        "plan_code": plan_code or "free",
        "plan_name_en": name_en or "Free",
        "plan_name_ar": name_ar or "مجاني",
        "status": billing.get("status", "active"),
        "current_period_end": period_end,
        "cancel_at_period_end": bool(billing.get("cancel_at_period_end", False)),
        "stripe_customer_id": billing.get("stripe_customer_id"),
        "provider": billing.get("provider"),
    }


# ── Stripe checkout via httpx ───────────────────────────────────────────────


async def create_stripe_checkout(
    tenant: Tenant, plan: Plan, currency: str = "usd"
) -> dict[str, Any]:
    if not settings.STRIPE_SECRET_KEY:
        return {
            "url": f"{settings.BILLING_SUCCESS_URL}?stub=stripe&plan={plan.slug}",
            "session_id": None,
            "provider": "stripe",
        }

    meta = _plan_meta(plan)
    price = meta.get("price_usd", plan.price_monthly or 0)
    unit_amount = int(round(float(price) * 100))

    # Stripe checkout session — form-encoded per their API
    data = {
        "mode": "subscription",
        "success_url": f"{settings.BILLING_SUCCESS_URL}?session_id={{CHECKOUT_SESSION_ID}}",
        "cancel_url": settings.BILLING_CANCEL_URL,
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": str(unit_amount),
        "line_items[0][price_data][recurring][interval]": "month",
        "line_items[0][price_data][product_data][name]": meta.get("name_en", plan.name),
        "line_items[0][quantity]": "1",
        "metadata[tenant_id]": str(tenant.id),
        "metadata[plan_code]": meta.get("code", plan.slug),
        "client_reference_id": str(tenant.id),
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.stripe.com/v1/checkout/sessions",
            data=data,
            auth=(settings.STRIPE_SECRET_KEY, ""),
        )
    if resp.status_code >= 400:
        raise HTTPException(
            status_code=502, detail=f"Stripe error: {resp.text[:400]}"
        )
    body = resp.json()
    return {
        "url": body["url"],
        "session_id": body["id"],
        "provider": "stripe",
    }


async def create_stripe_portal(tenant: Tenant) -> dict[str, Any]:
    if not settings.STRIPE_SECRET_KEY:
        return {"url": f"{settings.BILLING_SUCCESS_URL}?stub=portal"}

    cfg = tenant.config or {}
    customer_id = (cfg.get("billing") or {}).get("stripe_customer_id")
    if not customer_id:
        raise HTTPException(status_code=400, detail="No Stripe customer on file")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.stripe.com/v1/billing_portal/sessions",
            data={
                "customer": customer_id,
                "return_url": settings.BILLING_SUCCESS_URL,
            },
            auth=(settings.STRIPE_SECRET_KEY, ""),
        )
    if resp.status_code >= 400:
        raise HTTPException(
            status_code=502, detail=f"Stripe portal error: {resp.text[:400]}"
        )
    return {"url": resp.json()["url"]}


# ── Paymob (Accept) sequence ────────────────────────────────────────────────


async def create_paymob_payment(
    tenant: Tenant, plan: Plan, currency: str = "egp"
) -> dict[str, Any]:
    """Standard Paymob flow: auth → order → payment_key → iframe URL."""
    if not (
        settings.PAYMOB_API_KEY
        and settings.PAYMOB_INTEGRATION_ID
        and settings.PAYMOB_IFRAME_ID
    ):
        return {
            "url": f"{settings.BILLING_SUCCESS_URL}?stub=paymob&plan={plan.slug}",
            "session_id": None,
            "provider": "paymob",
        }

    meta = _plan_meta(plan)
    amount_egp = float(meta.get("price_egp", 0))
    amount_cents = int(round(amount_egp * 100))

    async with httpx.AsyncClient(timeout=30) as client:
        # 1. Auth
        auth = await client.post(
            "https://accept.paymob.com/api/auth/tokens",
            json={"api_key": settings.PAYMOB_API_KEY},
        )
        auth.raise_for_status()
        auth_token = auth.json()["token"]

        # 2. Order
        order = await client.post(
            "https://accept.paymob.com/api/ecommerce/orders",
            json={
                "auth_token": auth_token,
                "delivery_needed": False,
                "amount_cents": amount_cents,
                "currency": "EGP",
                "items": [
                    {
                        "name": meta.get("name_en", plan.name),
                        "amount_cents": amount_cents,
                        "description": f"Ignify subscription: {plan.slug}",
                        "quantity": 1,
                    }
                ],
                "merchant_order_id": f"{tenant.id}:{plan.slug}:{int(datetime.now(timezone.utc).timestamp())}",
            },
        )
        order.raise_for_status()
        order_id = order.json()["id"]

        # 3. Payment key
        pk = await client.post(
            "https://accept.paymob.com/api/acceptance/payment_keys",
            json={
                "auth_token": auth_token,
                "amount_cents": amount_cents,
                "expiration": 3600,
                "order_id": order_id,
                "billing_data": {
                    "apartment": "NA",
                    "email": "billing@ignify.ai",
                    "floor": "NA",
                    "first_name": tenant.name[:50] or "Customer",
                    "street": "NA",
                    "building": "NA",
                    "phone_number": "+201000000000",
                    "shipping_method": "NA",
                    "postal_code": "NA",
                    "city": "NA",
                    "country": "EG",
                    "last_name": "Tenant",
                    "state": "NA",
                },
                "currency": "EGP",
                "integration_id": int(settings.PAYMOB_INTEGRATION_ID),
                "extra": {
                    "tenant_id": str(tenant.id),
                    "plan_code": meta.get("code", plan.slug),
                },
            },
        )
        pk.raise_for_status()
        payment_token = pk.json()["token"]

    iframe_url = (
        f"https://accept.paymob.com/api/acceptance/iframes/"
        f"{settings.PAYMOB_IFRAME_ID}?payment_token={payment_token}"
    )
    return {"url": iframe_url, "session_id": str(order_id), "provider": "paymob"}


# ── PayTabs (MENA) ──────────────────────────────────────────────────────────


def _get_plan_price(plan: Plan, currency: str) -> float:
    """Resolve plan price based on currency. Approximate FX for SAR/AED from USD."""
    meta = _plan_meta(plan)
    c = (currency or "usd").lower()
    price_usd = float(meta.get("price_usd", plan.price_monthly or 0))
    price_egp = float(meta.get("price_egp", price_usd * 50))
    if c == "usd":
        return price_usd
    if c == "egp":
        return price_egp
    if c == "sar":
        return round(price_usd * 3.75, 2)
    if c == "aed":
        return round(price_usd * 3.67, 2)
    return price_usd


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=1, min=1, max=3))
async def _paytabs_post(url: str, server_key: str, payload: dict) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            url,
            json=payload,
            headers={
                "authorization": server_key,
                "content-type": "application/json",
            },
        )
    if resp.status_code >= 400:
        raise HTTPException(
            status_code=502, detail=f"PayTabs error: {resp.text[:400]}"
        )
    return resp.json()


async def create_paytabs_payment(
    tenant: Tenant,
    plan: Plan,
    currency: str = "egp",
    return_url: Optional[str] = None,
) -> dict[str, Any]:
    if not (settings.PAYTABS_SERVER_KEY and settings.PAYTABS_PROFILE_ID):
        return {
            "url": f"{settings.BILLING_SUCCESS_URL}?stub=paytabs&plan={plan.slug}",
            "session_id": None,
            "provider": "paytabs",
        }

    meta = _plan_meta(plan)
    amount = _get_plan_price(plan, currency)
    cart_id = f"{tenant.id}:{meta.get('code', plan.slug)}:{uuid.uuid4()}"
    ret = return_url or settings.BILLING_SUCCESS_URL

    payload = {
        "profile_id": settings.PAYTABS_PROFILE_ID,
        "tran_type": "sale",
        "tran_class": "ecom",
        "cart_id": cart_id,
        "cart_description": meta.get("name_en", plan.name),
        "cart_currency": currency.upper(),
        "cart_amount": amount,
        "callback": f"{settings.BILLING_CALLBACK_BASE}/api/v1/billing/webhooks/paytabs",
        "return": ret,
        "hide_shipping": True,
    }

    data = await _paytabs_post(
        f"{settings.PAYTABS_BASE_URL}/payment/request",
        settings.PAYTABS_SERVER_KEY,
        payload,
    )

    tran_ref = data.get("tran_ref")
    redirect_url = data.get("redirect_url")

    cfg = dict(tenant.config or {})
    billing = dict(cfg.get("billing") or {})
    billing["pending_paytabs_ref"] = tran_ref
    billing["pending_cart_id"] = cart_id
    cfg["billing"] = billing
    tenant.config = cfg

    return {
        "url": redirect_url or f"{settings.BILLING_SUCCESS_URL}?stub=paytabs",
        "session_id": tran_ref,
        "provider": "paytabs",
    }


# ── Geidea (MENA Pay by Link) ───────────────────────────────────────────────


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=1, min=1, max=3))
async def _geidea_post(url: str, auth_header: str, payload: dict) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            url,
            json=payload,
            headers={
                "Authorization": auth_header,
                "Content-Type": "application/json",
            },
        )
    if resp.status_code >= 400:
        raise HTTPException(
            status_code=502, detail=f"Geidea error: {resp.text[:400]}"
        )
    return resp.json()


async def create_geidea_paylink(
    tenant: Tenant,
    plan: Plan,
    currency: str = "sar",
    return_url: Optional[str] = None,
) -> dict[str, Any]:
    if not (settings.GEIDEA_PUBLIC_KEY and settings.GEIDEA_API_PASSWORD):
        return {
            "url": f"{settings.BILLING_SUCCESS_URL}?stub=geidea&plan={plan.slug}",
            "session_id": None,
            "provider": "geidea",
        }

    meta = _plan_meta(plan)
    amount = _get_plan_price(plan, currency)
    merchant_ref = f"{tenant.id}-{meta.get('code', plan.slug)}-{uuid.uuid4()}"
    ret = return_url or settings.BILLING_SUCCESS_URL

    creds = f"{settings.GEIDEA_PUBLIC_KEY}:{settings.GEIDEA_API_PASSWORD}".encode("utf-8")
    auth_header = "Basic " + base64.b64encode(creds).decode("ascii")

    payload = {
        "amount": float(amount),
        "currency": currency.upper(),
        "merchantReferenceId": merchant_ref,
        "callbackUrl": f"{settings.BILLING_CALLBACK_BASE}/api/v1/billing/webhooks/geidea",
        "returnUrl": ret,
        "expiryDate": (
            datetime.now(timezone.utc) + timedelta(days=7)
        ).isoformat(),
        "paymentOperation": "Pay",
        "order": {"integrationType": "Default"},
    }

    data = await _geidea_post(
        f"{settings.GEIDEA_BASE_URL}/payment-intent/api/v2/direct/paymentlink",
        auth_header,
        payload,
    )

    pi = data.get("paymentIntent") or {}
    link = pi.get("paymentLink") or data.get("paymentLink")
    order_id = data.get("orderId") or pi.get("orderId")

    cfg = dict(tenant.config or {})
    billing = dict(cfg.get("billing") or {})
    billing["pending_geidea_ref"] = merchant_ref
    billing["pending_geidea_order_id"] = order_id
    cfg["billing"] = billing
    tenant.config = cfg

    return {
        "url": link or f"{settings.BILLING_SUCCESS_URL}?stub=geidea",
        "session_id": order_id or merchant_ref,
        "provider": "geidea",
    }


# ── Webhook handlers ────────────────────────────────────────────────────────


def _verify_stripe_signature(payload: bytes, sig_header: str, secret: str) -> bool:
    """Verify Stripe webhook signature (t=..,v1=..)."""
    if not secret or not sig_header:
        return False
    try:
        parts = dict(p.split("=", 1) for p in sig_header.split(","))
        ts = parts.get("t")
        v1 = parts.get("v1")
        if not ts or not v1:
            return False
        signed = f"{ts}.{payload.decode('utf-8')}".encode("utf-8")
        digest = hmac.new(secret.encode("utf-8"), signed, hashlib.sha256).hexdigest()
        return hmac.compare_digest(digest, v1)
    except Exception:
        return False


async def handle_stripe_webhook(
    db: AsyncSession, payload: bytes, signature: str
) -> dict[str, str]:
    if settings.STRIPE_WEBHOOK_SECRET and not _verify_stripe_signature(
        payload, signature, settings.STRIPE_WEBHOOK_SECRET
    ):
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")

    try:
        event = json.loads(payload.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    etype = event.get("type", "")
    obj = event.get("data", {}).get("object", {}) or {}

    if etype == "checkout.session.completed":
        meta = obj.get("metadata") or {}
        tenant_id = meta.get("tenant_id")
        plan_code = meta.get("plan_code")
        customer = obj.get("customer")
        subscription_id = obj.get("subscription")
        if tenant_id and plan_code:
            await _apply_subscription(
                db,
                uuid.UUID(tenant_id),
                plan_code,
                status_val="active",
                provider="stripe",
                stripe_customer_id=customer,
                stripe_subscription_id=subscription_id,
            )
    elif etype in ("customer.subscription.updated", "customer.subscription.deleted"):
        customer = obj.get("customer")
        status_val = obj.get("status", "cancelled")
        cancel_at_end = bool(obj.get("cancel_at_period_end", False))
        period_end = obj.get("current_period_end")
        if customer:
            await _update_subscription_by_customer(
                db,
                customer_id=customer,
                status_val="cancelled" if etype.endswith("deleted") else status_val,
                cancel_at_end=cancel_at_end,
                period_end=period_end,
            )

    await db.commit()
    return {"received": "ok"}


def _verify_paymob_hmac(data: dict, received: str, secret: str) -> bool:
    """Paymob HMAC: concatenate specific fields in order, HMAC-SHA512."""
    if not secret or not received:
        return False
    o = data.get("obj", data)
    try:
        concat = (
            str(o.get("amount_cents", ""))
            + str(o.get("created_at", ""))
            + str(o.get("currency", ""))
            + str(o.get("error_occured", "")).lower()
            + str(o.get("has_parent_transaction", "")).lower()
            + str(o.get("id", ""))
            + str(o.get("integration_id", ""))
            + str(o.get("is_3d_secure", "")).lower()
            + str(o.get("is_auth", "")).lower()
            + str(o.get("is_capture", "")).lower()
            + str(o.get("is_refunded", "")).lower()
            + str(o.get("is_standalone_payment", "")).lower()
            + str(o.get("is_voided", "")).lower()
            + str((o.get("order") or {}).get("id", ""))
            + str(o.get("owner", ""))
            + str(o.get("pending", "")).lower()
            + str((o.get("source_data") or {}).get("pan", ""))
            + str((o.get("source_data") or {}).get("sub_type", ""))
            + str((o.get("source_data") or {}).get("type", ""))
            + str(o.get("success", "")).lower()
        )
        digest = hmac.new(
            secret.encode("utf-8"), concat.encode("utf-8"), hashlib.sha512
        ).hexdigest()
        return hmac.compare_digest(digest, received)
    except Exception:
        return False


async def handle_paymob_callback(
    db: AsyncSession, payload: dict, hmac_header: str
) -> dict[str, str]:
    if settings.PAYMOB_HMAC_SECRET and not _verify_paymob_hmac(
        payload, hmac_header, settings.PAYMOB_HMAC_SECRET
    ):
        raise HTTPException(status_code=400, detail="Invalid Paymob HMAC")

    obj = payload.get("obj", payload)
    success = bool(obj.get("success"))
    extra = (obj.get("payment_key_claims") or {}).get("extra") or {}
    if not extra:
        # try top-level
        extra = obj.get("extra") or {}
    tenant_id = extra.get("tenant_id")
    plan_code = extra.get("plan_code")

    if success and tenant_id and plan_code:
        await _apply_subscription(
            db,
            uuid.UUID(tenant_id),
            plan_code,
            status_val="active",
            provider="paymob",
        )
        await db.commit()

    return {"received": "ok"}


def _verify_paytabs_signature(body: bytes, signature: str, server_key: str) -> bool:
    """PayTabs signs the raw response body with HMAC-SHA256 using server_key."""
    if not (server_key and signature):
        return False
    try:
        digest = hmac.new(
            server_key.encode("utf-8"), body, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(digest, signature)
    except Exception:
        return False


async def handle_paytabs_webhook(
    db: AsyncSession, payload: dict, signature: str, raw_body: bytes = b""
) -> bool:
    if settings.PAYTABS_SERVER_KEY and raw_body:
        if not _verify_paytabs_signature(
            raw_body, signature, settings.PAYTABS_SERVER_KEY
        ):
            raise HTTPException(status_code=400, detail="Invalid PayTabs signature")

    payment_result = payload.get("payment_result") or {}
    response_status = payment_result.get("response_status") or payload.get(
        "response_status"
    )

    cart_id = payload.get("cart_id") or (payload.get("cart") or {}).get("id", "")
    # cart_id format: {tenant_id}:{plan_code}:{uuid}
    parts = str(cart_id).split(":")
    if len(parts) < 2:
        return False
    tenant_id_s, plan_code = parts[0], parts[1]

    if response_status == "A":
        try:
            await _apply_subscription(
                db,
                uuid.UUID(tenant_id_s),
                plan_code,
                status_val="active",
                provider="paytabs",
            )
        except (ValueError, KeyError):
            return False
        # Stash tran_ref
        tran_ref = payload.get("tran_ref")
        tenant = (
            await db.execute(
                select(Tenant).where(Tenant.id == uuid.UUID(tenant_id_s))
            )
        ).scalar_one_or_none()
        if tenant:
            cfg = dict(tenant.config or {})
            billing = dict(cfg.get("billing") or {})
            billing["paytabs_tran_ref"] = tran_ref
            cfg["billing"] = billing
            tenant.config = cfg
        await db.commit()
        return True
    return False


def _verify_geidea_signature(
    amount: Any,
    currency: str,
    merchant_public_key: str,
    order_id: str,
    timestamp: str,
    signature: str,
    api_password: str,
) -> bool:
    """Geidea HMAC-SHA256 over '{amount}{currency}{merchantPublicKey}{orderId}{timestamp}'."""
    if not (api_password and signature):
        return False
    try:
        concat = f"{amount}{currency}{merchant_public_key}{order_id}{timestamp}"
        digest = hmac.new(
            api_password.encode("utf-8"),
            concat.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(digest, signature)
    except Exception:
        return False


async def handle_geidea_webhook(
    db: AsyncSession, payload: dict, signature_header: str
) -> bool:
    order = payload.get("order") or payload
    amount = order.get("amount") or payload.get("amount")
    currency = order.get("currency") or payload.get("currency") or ""
    order_id = order.get("orderId") or payload.get("orderId") or ""
    merchant_public_key = (
        payload.get("merchantPublicKey")
        or order.get("merchantPublicKey")
        or settings.GEIDEA_PUBLIC_KEY
    )
    timestamp = payload.get("timestamp") or order.get("timestamp") or ""
    sig = signature_header or payload.get("signature") or ""

    if settings.GEIDEA_API_PASSWORD and sig:
        if not _verify_geidea_signature(
            amount,
            currency,
            merchant_public_key,
            order_id,
            timestamp,
            sig,
            settings.GEIDEA_API_PASSWORD,
        ):
            raise HTTPException(status_code=400, detail="Invalid Geidea signature")

    status_val = (order.get("status") or payload.get("status") or "").lower()
    merchant_ref = (
        order.get("merchantReferenceId")
        or payload.get("merchantReferenceId")
        or ""
    )
    # merchant_ref format: {tenant_id}-{plan_code}-{uuid}
    parts = str(merchant_ref).split("-", 2)
    if len(parts) < 2:
        # tenant_id is itself a UUID with hyphens; try a different split:
        # rebuild by locating the last segment (uuid has 36 chars incl. hyphens)
        # Safer parse: try to extract a UUID prefix
        import re as _re

        m = _re.match(
            r"^([0-9a-fA-F-]{36})-([^-]+)-.+$",
            merchant_ref,
        )
        if not m:
            return False
        tenant_id_s, plan_code = m.group(1), m.group(2)
    else:
        # Same issue — attempt UUID-aware parse first
        import re as _re

        m = _re.match(
            r"^([0-9a-fA-F-]{36})-([^-]+)-.+$",
            merchant_ref,
        )
        if m:
            tenant_id_s, plan_code = m.group(1), m.group(2)
        else:
            tenant_id_s, plan_code = parts[0], parts[1]

    if status_val in ("success", "paid", "captured"):
        try:
            await _apply_subscription(
                db,
                uuid.UUID(tenant_id_s),
                plan_code,
                status_val="active",
                provider="geidea",
            )
        except ValueError:
            return False
        tenant = (
            await db.execute(
                select(Tenant).where(Tenant.id == uuid.UUID(tenant_id_s))
            )
        ).scalar_one_or_none()
        if tenant:
            cfg = dict(tenant.config or {})
            billing = dict(cfg.get("billing") or {})
            billing["geidea_order_id"] = order_id
            cfg["billing"] = billing
            tenant.config = cfg
        await db.commit()
        return True
    return False


async def _apply_subscription(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    plan_code: str,
    status_val: str,
    provider: str,
    stripe_customer_id: Optional[str] = None,
    stripe_subscription_id: Optional[str] = None,
) -> None:
    plan = await get_plan_by_code(db, plan_code)
    if not plan:
        return
    tenant = (
        await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    ).scalar_one_or_none()
    if not tenant:
        return
    tenant.plan_id = plan.id
    cfg = dict(tenant.config or {})
    billing = dict(cfg.get("billing") or {})
    billing.update(
        {
            "status": status_val,
            "provider": provider,
            "current_period_end": (
                datetime.now(timezone.utc) + timedelta(days=30)
            ).isoformat(),
            "cancel_at_period_end": False,
        }
    )
    if stripe_customer_id:
        billing["stripe_customer_id"] = stripe_customer_id
    if stripe_subscription_id:
        billing["stripe_subscription_id"] = stripe_subscription_id
    cfg["billing"] = billing
    tenant.config = cfg


async def _update_subscription_by_customer(
    db: AsyncSession,
    customer_id: str,
    status_val: str,
    cancel_at_end: bool,
    period_end: Optional[int],
) -> None:
    result = await db.execute(select(Tenant))
    for tenant in result.scalars().all():
        cfg = tenant.config or {}
        billing = (cfg.get("billing") or {}) if isinstance(cfg, dict) else {}
        if billing.get("stripe_customer_id") == customer_id:
            billing["status"] = status_val
            billing["cancel_at_period_end"] = cancel_at_end
            if period_end:
                billing["current_period_end"] = datetime.fromtimestamp(
                    period_end, tz=timezone.utc
                ).isoformat()
            new_cfg = dict(cfg)
            new_cfg["billing"] = billing
            tenant.config = new_cfg
            break


# ── Quota / usage ───────────────────────────────────────────────────────────


RESOURCE_MODELS = {
    "articles": ContentPost,
    "images": CreativeAsset,
    # "videos" handled specially via CreativeAsset metadata / credit transactions
}


async def _get_tenant_plan(
    db: AsyncSession, tenant_id: uuid.UUID
) -> tuple[Optional[Tenant], Optional[Plan]]:
    tenant = (
        await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    ).scalar_one_or_none()
    if not tenant:
        return None, None
    if not tenant.plan_id:
        # default: free plan
        free = (
            await db.execute(select(Plan).where(Plan.slug == "free"))
        ).scalar_one_or_none()
        if free is None:
            await _seed_default_plans(db)
            await db.commit()
            free = (
                await db.execute(select(Plan).where(Plan.slug == "free"))
            ).scalar_one_or_none()
        return tenant, free
    plan = (
        await db.execute(select(Plan).where(Plan.id == tenant.plan_id))
    ).scalar_one_or_none()
    return tenant, plan


async def _count_usage(
    db: AsyncSession, tenant_id: uuid.UUID, resource: str
) -> int:
    """Count records created in the last 30 days for the given resource."""
    model = RESOURCE_MODELS.get(resource)
    since = datetime.now(timezone.utc) - timedelta(days=30)
    if model is None:
        # videos: count via credit_transactions action_type
        if resource == "videos":
            from app.db.models import CreditTransaction

            result = await db.execute(
                select(func.count(CreditTransaction.id))
                .where(CreditTransaction.tenant_id == tenant_id)
                .where(CreditTransaction.action_type.ilike("video%"))
                .where(CreditTransaction.created_at >= since)
            )
            return int(result.scalar() or 0)
        # ai_tokens or unknown: track via credit transactions (approximation)
        if resource == "ai_tokens":
            from app.db.models import CreditTransaction

            result = await db.execute(
                select(func.coalesce(func.sum(CreditTransaction.credits_used), 0))
                .where(CreditTransaction.tenant_id == tenant_id)
                .where(CreditTransaction.credits_used > 0)
                .where(CreditTransaction.created_at >= since)
            )
            return int(result.scalar() or 0)
        return 0
    # Most content/creative/video models have tenant_id + created_at
    try:
        result = await db.execute(
            select(func.count(model.id))
            .where(getattr(model, "tenant_id") == tenant_id)
            .where(getattr(model, "created_at") >= since)
        )
        return int(result.scalar() or 0)
    except Exception:
        return 0


async def check_quota(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    resource: str,
    amount: int = 1,
) -> None:
    """Raise HTTP 402 if quota would be exceeded."""
    _, plan = await _get_tenant_plan(db, tenant_id)
    if not plan:
        return  # no plan → let through (bootstrap)
    limits = (_plan_meta(plan).get("limits") or {})
    quota = limits.get(resource)
    if quota is None:
        return
    if quota == -1:
        return  # unlimited
    used = await _count_usage(db, tenant_id, resource)
    if used + amount > int(quota):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "quota_exceeded",
                "resource": resource,
                "quota": quota,
                "used": used,
                "message": f"Quota exceeded for {resource}. Upgrade your plan.",
            },
        )


async def get_usage(db: AsyncSession, tenant_id: uuid.UUID) -> dict[str, Any]:
    _, plan = await _get_tenant_plan(db, tenant_id)
    limits = (_plan_meta(plan).get("limits") if plan else {}) or {}
    resources = ["articles", "images", "videos", "ai_tokens"]
    quota: dict[str, Any] = {}
    used: dict[str, int] = {}
    remaining: dict[str, Any] = {}
    for r in resources:
        q = limits.get(r, 0)
        u = await _count_usage(db, tenant_id, r)
        quota[r] = q
        used[r] = u
        if q == -1:
            remaining[r] = -1
        else:
            remaining[r] = max(0, int(q) - u)
    return {"quota": quota, "used": used, "remaining": remaining}
