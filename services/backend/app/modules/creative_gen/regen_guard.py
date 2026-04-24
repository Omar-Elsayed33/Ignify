"""Regeneration limit guard — caps how many times a tenant can re-roll
creative images for the same source content post.

Why this exists
---------------
Without a cap, a tenant can spam `POST /creative-gen/generate?plan_id=X`
forever, burning through their AI budget on slightly-different versions
of the same post. One retry is reasonable ("I didn't like the vibe,
try once more"); three is wasteful; ten is abuse.

Implementation
--------------
We count CreativeAsset rows where:
  tenant_id = this tenant
  AND metadata->'content_post_id' = the requested post
  AND asset_type = 'image'

If that count is already >= MAX_GENERATIONS_PER_POST (initial + 1 regen),
we refuse with `RegenLimitExceeded` → router surfaces HTTP 429 with code
`creative_regen_limit_reached`. Front-end shows "You've already regenerated
this creative once. Make smaller edits to the prompt or approve the
existing version."

Cost safety layer is SEPARATE — this guard is about user intent, not
about money. A wealthy tenant with $300 budget left still can't loop
infinite regens on one post.
"""
from __future__ import annotations

import uuid

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AssetType, CreativeAsset

# initial_generation + 1 regeneration = 2 total. Sized small because the
# real fix for bad output is editing the SOURCE post, not re-rolling.
MAX_GENERATIONS_PER_POST = 2


class RegenLimitExceeded(Exception):
    """Raised when a tenant has already used their regeneration budget for
    a specific content post. Translated to HTTP 429 at the router layer."""
    def __init__(self, *, content_post_id: uuid.UUID, existing_count: int) -> None:
        self.content_post_id = content_post_id
        self.existing_count = existing_count
        super().__init__(
            f"Creative regen limit reached for content_post {content_post_id} "
            f"(already produced {existing_count} asset(s); cap is "
            f"{MAX_GENERATIONS_PER_POST})"
        )


async def count_existing_creatives_for_post(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    content_post_id: uuid.UUID,
) -> int:
    """How many CreativeAsset rows reference this content_post_id?

    We store `content_post_id` inside `CreativeAsset.metadata_` (there's no
    FK column) — use JSON extraction to filter. Plain `JSON` columns in
    SQLAlchemy don't expose `.astext`, so we use the raw SQL path like the
    deep-runs counter does.
    """
    from sqlalchemy import text as _sql_text
    result = await db.execute(
        _sql_text(
            """
            SELECT COUNT(*) AS n
            FROM creative_assets
            WHERE tenant_id = :t
              AND asset_type = 'image'
              AND jsonb_extract_path_text(metadata::jsonb, 'content_post_id') = :cp
            """
        ),
        {"t": tenant_id, "cp": str(content_post_id)},
    )
    row = result.first()
    return int((row.n if row else 0) or 0)


async def check_regen_limit(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    content_post_id: uuid.UUID | None,
) -> int:
    """Raise RegenLimitExceeded if the tenant has already hit the cap for
    this content post. Returns the current count on success so the caller
    can pass it through in metadata.

    A None content_post_id means the generation isn't linked to any post
    (standalone creative) — we don't count those since the user can't spam
    them against a single anchor.
    """
    if content_post_id is None:
        return 0
    count = await count_existing_creatives_for_post(db, tenant_id, content_post_id)
    if count >= MAX_GENERATIONS_PER_POST:
        raise RegenLimitExceeded(
            content_post_id=content_post_id, existing_count=count
        )
    return count
