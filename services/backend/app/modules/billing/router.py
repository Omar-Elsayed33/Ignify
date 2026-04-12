from __future__ import annotations

import json

from fastapi import APIRouter, Header, HTTPException, Request, status
from sqlalchemy import func, select

from app.db.models import CreditBalance, CreditPurchase, CreditTransaction, Tenant
from app.dependencies import CurrentUser, DbSession
from app.modules.billing.schemas import (
    BalanceResponse,
    CheckoutRequest,
    CheckoutResponse,
    CreditPurchaseRequest,
    CreditPurchaseResponse,
    CreditTransactionResponse,
    PlanListItem,
    PortalResponse,
    SubscriptionStatus,
    UsageResponse,
    UsageSummaryResponse,
)
from app.modules.billing.service import (
    create_geidea_paylink,
    create_paymob_payment,
    create_paytabs_payment,
    create_stripe_checkout,
    create_stripe_portal,
    get_plan_by_code,
    get_subscription_status,
    get_usage,
    handle_geidea_webhook,
    handle_paymob_callback,
    handle_paytabs_webhook,
    handle_stripe_webhook,
    list_plans,
)

router = APIRouter(prefix="/billing", tags=["billing"])


# ── Plans & subscription ────────────────────────────────────────────────────


@router.get("/plans", response_model=list[PlanListItem])
async def get_plans(db: DbSession, currency: str | None = None):
    """Public listing of active plans. Pass ``?currency=USD|EGP|SAR|AED`` for
    localized prices. Also returned in ``prices`` (all currencies) for clients
    that want to switch on the fly without re-fetching.
    """
    return await list_plans(db, currency=currency)


@router.get("/plans/public", response_model=list[PlanListItem])
async def get_plans_public(db: DbSession, currency: str | None = None):
    """Alias for ``/plans`` with no auth — kept explicit for the marketing site."""
    return await list_plans(db, currency=currency)


@router.get("/subscription", response_model=SubscriptionStatus)
async def get_subscription(user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=403, detail="No tenant")
    return await get_subscription_status(db, user.tenant_id)


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    data: CheckoutRequest, user: CurrentUser, db: DbSession
):
    if not user.tenant_id:
        raise HTTPException(status_code=403, detail="No tenant")
    tenant = (
        await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    ).scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    plan = await get_plan_by_code(db, data.plan_code)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    provider = data.provider
    # Back-compat: default egp currency → paymob unless another provider explicitly chosen
    if provider == "stripe" and data.currency != "usd":
        provider = "paymob" if data.currency == "egp" else "paytabs"

    if provider == "stripe":
        result = await create_stripe_checkout(tenant, plan, data.currency)
    elif provider == "paymob":
        result = await create_paymob_payment(tenant, plan, data.currency)
    elif provider == "paytabs":
        result = await create_paytabs_payment(tenant, plan, data.currency)
    elif provider == "geidea":
        result = await create_geidea_paylink(tenant, plan, data.currency)
    else:
        raise HTTPException(status_code=400, detail="Unsupported provider")
    await db.commit()
    return result


@router.post("/portal", response_model=PortalResponse)
async def billing_portal(user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=403, detail="No tenant")
    tenant = (
        await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    ).scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return await create_stripe_portal(tenant)


# ── Webhooks ────────────────────────────────────────────────────────────────


@router.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    db: DbSession,
    stripe_signature: str = Header(default="", alias="Stripe-Signature"),
):
    payload = await request.body()
    return await handle_stripe_webhook(db, payload, stripe_signature)


@router.post("/webhooks/paymob")
async def paymob_webhook(
    request: Request,
    db: DbSession,
    hmac: str = Header(default=""),
):
    payload = await request.json()
    # Paymob sends HMAC as `hmac` header or query param
    header_hmac = hmac or request.query_params.get("hmac", "")
    return await handle_paymob_callback(db, payload, header_hmac)


@router.post("/webhooks/paytabs")
async def paytabs_webhook(request: Request, db: DbSession):
    body = await request.body()
    sig = request.headers.get("signature", "") or request.headers.get(
        "Signature", ""
    )
    try:
        payload = json.loads(body or b"{}")
    except json.JSONDecodeError:
        payload = {}
    ok = await handle_paytabs_webhook(db, payload, sig, raw_body=body)
    return {"received": True, "ok": ok}


@router.post("/webhooks/geidea")
async def geidea_webhook(request: Request, db: DbSession):
    body = await request.body()
    sig = (
        request.headers.get("x-geidea-signature")
        or request.headers.get("X-Geidea-Signature")
        or request.headers.get("signature", "")
    )
    try:
        payload = json.loads(body or b"{}")
    except json.JSONDecodeError:
        payload = {}
    ok = await handle_geidea_webhook(db, payload, sig)
    return {"received": True, "ok": ok}


# ── Usage / quota ───────────────────────────────────────────────────────────


@router.get("/usage", response_model=UsageResponse)
async def usage_endpoint(user: CurrentUser, db: DbSession):
    if not user.tenant_id:
        raise HTTPException(status_code=403, detail="No tenant")
    return await get_usage(db, user.tenant_id)


# ── Legacy credit-based endpoints (kept) ────────────────────────────────────


@router.get("/balance", response_model=BalanceResponse)
async def get_balance(user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(CreditBalance).where(CreditBalance.tenant_id == user.tenant_id)
    )
    balance = result.scalar_one_or_none()
    if not balance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No credit balance found"
        )
    return balance


@router.get("/transactions", response_model=list[CreditTransactionResponse])
async def list_transactions(user: CurrentUser, db: DbSession, skip: int = 0, limit: int = 100):
    result = await db.execute(
        select(CreditTransaction)
        .where(CreditTransaction.tenant_id == user.tenant_id)
        .order_by(CreditTransaction.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/usage-credits", response_model=UsageSummaryResponse)
async def get_credits_usage_summary(user: CurrentUser, db: DbSession):
    tid = user.tenant_id

    total_used = (
        await db.execute(
            select(func.coalesce(func.sum(CreditTransaction.credits_used), 0))
            .where(CreditTransaction.tenant_id == tid)
        )
    ).scalar() or 0

    total_purchased = (
        await db.execute(
            select(func.coalesce(func.sum(CreditPurchase.credits), 0))
            .where(CreditPurchase.tenant_id == tid)
        )
    ).scalar() or 0

    tx_count = (
        await db.execute(
            select(func.count(CreditTransaction.id)).where(CreditTransaction.tenant_id == tid)
        )
    ).scalar() or 0

    balance_result = await db.execute(select(CreditBalance).where(CreditBalance.tenant_id == tid))
    balance = balance_result.scalar_one_or_none()
    current_balance = balance.balance if balance else 0

    return UsageSummaryResponse(
        total_credits_used=total_used,
        total_credits_purchased=total_purchased,
        current_balance=current_balance,
        transaction_count=tx_count,
    )


@router.post("/purchase", response_model=CreditPurchaseResponse, status_code=status.HTTP_201_CREATED)
async def purchase_credits(data: CreditPurchaseRequest, user: CurrentUser, db: DbSession):
    purchase = CreditPurchase(
        tenant_id=user.tenant_id,
        amount=data.amount,
        credits=data.credits,
        payment_ref=data.payment_ref,
    )
    db.add(purchase)

    balance_result = await db.execute(
        select(CreditBalance).where(CreditBalance.tenant_id == user.tenant_id)
    )
    balance = balance_result.scalar_one_or_none()
    if balance:
        balance.balance += data.credits
    else:
        balance = CreditBalance(tenant_id=user.tenant_id, balance=data.credits)
        db.add(balance)

    tx = CreditTransaction(
        tenant_id=user.tenant_id,
        action_type="purchase",
        credits_used=-data.credits,
        description=f"Purchased {data.credits} credits",
    )
    db.add(tx)
    await db.flush()
    return purchase
