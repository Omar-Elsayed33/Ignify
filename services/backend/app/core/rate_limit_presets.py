"""Reusable rate-limit dependency presets.

Apply to FastAPI routes via ``dependencies=[<PRESET>]``. All user-scoped
limits bucket by ``user.id``; PUBLIC_IP buckets by client IP for unauthenticated
endpoints (contact forms, invite accept, email verification).
"""
from __future__ import annotations

from app.core.rate_limit import rate_limit_dep

# Per-user-per-hour caps for logged-in endpoints
STRICT = rate_limit_dep(limit=10, window_seconds=3600)    # heavy AI ops
MEDIUM = rate_limit_dep(limit=60, window_seconds=3600)    # normal writes
LOOSE = rate_limit_dep(limit=200, window_seconds=3600)    # light writes

# Per-minute burst cap (stack alongside hourly limits on very hot endpoints)
BURST = rate_limit_dep(limit=30, window_seconds=60)

# Unauthenticated endpoints: bucket by client IP
PUBLIC_IP = rate_limit_dep(limit=20, window_seconds=60, scope="ip")
