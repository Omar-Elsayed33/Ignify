from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.db.models import CreditBalance, CreditPurchase, CreditTransaction
from app.dependencies import CurrentUser, DbSession
from app.modules.billing.schemas import (
    BalanceResponse,
    CreditPurchaseRequest,
    CreditPurchaseResponse,
    CreditTransactionResponse,
    UsageSummaryResponse,
)

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/balance", response_model=BalanceResponse)
async def get_balance(user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(CreditBalance).where(CreditBalance.tenant_id == user.tenant_id)
    )
    balance = result.scalar_one_or_none()
    if not balance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No credit balance found")
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


@router.get("/usage", response_model=UsageSummaryResponse)
async def get_usage_summary(user: CurrentUser, db: DbSession):
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

    # Update balance
    balance_result = await db.execute(
        select(CreditBalance).where(CreditBalance.tenant_id == user.tenant_id)
    )
    balance = balance_result.scalar_one_or_none()
    if balance:
        balance.balance += data.credits
    else:
        balance = CreditBalance(tenant_id=user.tenant_id, balance=data.credits)
        db.add(balance)

    # Record transaction
    tx = CreditTransaction(
        tenant_id=user.tenant_id,
        action_type="purchase",
        credits_used=-data.credits,  # negative = credits added
        description=f"Purchased {data.credits} credits",
    )
    db.add(tx)
    await db.flush()
    return purchase
