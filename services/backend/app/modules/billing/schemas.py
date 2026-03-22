import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


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
