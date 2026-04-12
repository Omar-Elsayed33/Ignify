from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


Topic = Literal["sales", "support", "partnership", "general", "demo", "pricing"]


class PublicLeadCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=50)
    company: Optional[str] = Field(default=None, max_length=200)
    message: str = Field(min_length=1, max_length=5000)
    topic: Topic = "sales"
    source: str = "website"


class PublicLeadResponse(BaseModel):
    success: bool = True
