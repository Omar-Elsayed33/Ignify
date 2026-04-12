from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel


# ── Legacy credit schemas (kept for compatibility) ──────────────────────────


class BalanceResponse(BaseModel):
    tenant_id: uuid.UUID
    balance: int
    updated_at: datetime

    model_config = {"from_attributes": True}


class CreditTransactionResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    action_type: str
    credits_used: int
    description: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CreditPurchaseRequest(BaseModel):
    amount: float
    credits: int
    payment_ref: Optional[str] = None


class CreditPurchaseResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    amount: float
    credits: int
    payment_ref: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UsageSummaryResponse(BaseModel):
    total_credits_used: int
    total_credits_purchased: int
    current_balance: int
    transaction_count: int


# ── New subscription / plan schemas ─────────────────────────────────────────


class PlanListItem(BaseModel):
    id: uuid.UUID
    code: str
    name_en: str
    name_ar: str
    price_usd: float
    price_egp: float
    # Per-currency prices: {"USD": {"monthly": x, "yearly": y}, "EGP": {...}, ...}
    prices: dict[str, Any] = {}
    # Currency-localized (when `?currency=` is passed). Empty dict otherwise.
    price: dict[str, float] = {}
    currency: Optional[str] = None
    features: list[str]
    limits: dict[str, Any]
    popular: bool = False
    is_active: bool = True


class SubscriptionStatus(BaseModel):
    plan_code: Optional[str]
    plan_name_en: Optional[str] = None
    plan_name_ar: Optional[str] = None
    status: str
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool = False
    stripe_customer_id: Optional[str] = None
    provider: Optional[str] = None


class CheckoutRequest(BaseModel):
    plan_code: str
    provider: Literal["stripe", "paymob", "paytabs", "geidea"] = "stripe"
    currency: Literal["usd", "egp", "sar", "aed"] = "usd"


class CheckoutResponse(BaseModel):
    url: str
    session_id: Optional[str] = None
    provider: str


class UsageResponse(BaseModel):
    quota: dict[str, Any]
    used: dict[str, int]
    remaining: dict[str, Any]


class PortalResponse(BaseModel):
    url: str
