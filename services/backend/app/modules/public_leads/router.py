"""Public lead capture endpoint — no auth, rate-limited by IP."""
from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import APIRouter, HTTPException, Request, status

from app.dependencies import DbSession
from app.modules.public_leads import service
from app.modules.public_leads.schemas import PublicLeadCreate, PublicLeadResponse


router = APIRouter(prefix="/leads", tags=["public-leads"])


# In-memory rate limiter: 5 requests per 60 seconds per IP
_WINDOW_SECONDS = 60
_MAX_REQUESTS = 5
_ip_hits: dict[str, deque[float]] = defaultdict(deque)


def _rate_limited(ip: str) -> bool:
    now = time.time()
    hits = _ip_hits[ip]
    while hits and (now - hits[0]) > _WINDOW_SECONDS:
        hits.popleft()
    if len(hits) >= _MAX_REQUESTS:
        return True
    hits.append(now)
    return False


@router.post(
    "/public",
    response_model=PublicLeadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_public_lead(
    data: PublicLeadCreate, request: Request, db: DbSession
):
    ip = request.client.host if request.client else "unknown"
    if _rate_limited(ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
        )
    await service.create_public_lead(db, data)
    return PublicLeadResponse(success=True)
