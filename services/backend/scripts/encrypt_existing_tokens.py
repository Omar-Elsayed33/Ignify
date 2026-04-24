"""One-shot sweep: encrypt any pre-migration plaintext tokens at rest.

Idempotent. Safe to re-run. Leaves already-Fernet-encoded values untouched.

Tables / columns covered:
- social_accounts.access_token_encrypted
- social_accounts.refresh_token_encrypted  (from migration q7r8s9t0u1v2)
- ad_accounts.access_token_encrypted
- ad_accounts.refresh_token_encrypted
- integration_tokens.access_token_encrypted
- integration_tokens.refresh_token_encrypted
- tenant_openrouter_config.openrouter_key_encrypted
- tenant_ai_configs.api_key_encrypted

Run inside the backend container:
    docker compose exec backend python -m scripts.encrypt_existing_tokens
    docker compose exec backend python -m scripts.encrypt_existing_tokens --dry-run
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import _CIPHERTEXT_PREFIX, encrypt_token
from app.db.database import async_session as async_session_maker

logger = logging.getLogger("encrypt_sweep")


@dataclass
class ColumnTarget:
    table: str
    id_col: str
    token_col: str


TARGETS: list[ColumnTarget] = [
    ColumnTarget("social_accounts", "id", "access_token_encrypted"),
    ColumnTarget("social_accounts", "id", "refresh_token_encrypted"),
    ColumnTarget("ad_accounts", "id", "access_token_encrypted"),
    ColumnTarget("ad_accounts", "id", "refresh_token_encrypted"),
    ColumnTarget("integration_tokens", "id", "access_token_encrypted"),
    ColumnTarget("integration_tokens", "id", "refresh_token_encrypted"),
    ColumnTarget("tenant_openrouter_config", "id", "openrouter_key_encrypted"),
    ColumnTarget("tenant_ai_configs", "id", "api_key_encrypted"),
]


async def _table_exists(session: AsyncSession, table: str) -> bool:
    result = await session.execute(
        text("SELECT to_regclass(:t) IS NOT NULL AS exists"),
        {"t": f"public.{table}"},
    )
    row = result.first()
    return bool(row and row.exists)


async def _column_exists(session: AsyncSession, table: str, column: str) -> bool:
    result = await session.execute(
        text(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = :t AND column_name = :c
            """
        ),
        {"t": table, "c": column},
    )
    return result.first() is not None


async def sweep_column(
    session: AsyncSession, target: ColumnTarget, dry_run: bool
) -> tuple[int, int]:
    """Returns (scanned, encrypted_now)."""
    if not await _table_exists(session, target.table):
        logger.info("  skip %s (table does not exist)", target.table)
        return (0, 0)
    if not await _column_exists(session, target.table, target.token_col):
        logger.info("  skip %s.%s (column does not exist)", target.table, target.token_col)
        return (0, 0)

    result = await session.execute(
        text(
            f"""
            SELECT {target.id_col} AS id, {target.token_col} AS tok
            FROM {target.table}
            WHERE {target.token_col} IS NOT NULL
              AND {target.token_col} != ''
              AND {target.token_col} NOT LIKE :pfx
            """
        ),
        {"pfx": f"{_CIPHERTEXT_PREFIX}%"},
    )
    rows = result.fetchall()
    scanned = len(rows)
    if scanned == 0:
        return (0, 0)

    if dry_run:
        logger.info("  %s.%s: %d plaintext rows (DRY RUN — not modified)",
                    target.table, target.token_col, scanned)
        return (scanned, 0)

    encrypted = 0
    for row in rows:
        ct = encrypt_token(row.tok)
        await session.execute(
            text(
                f"UPDATE {target.table} SET {target.token_col} = :ct WHERE {target.id_col} = :id"
            ),
            {"ct": ct, "id": row.id},
        )
        encrypted += 1
    return (scanned, encrypted)


async def main(dry_run: bool) -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    logger.info("Encrypting any remaining plaintext tokens%s",
                " (DRY RUN)" if dry_run else "")

    total_scanned = 0
    total_encrypted = 0
    async with async_session_maker() as session:
        for t in TARGETS:
            scanned, encrypted = await sweep_column(session, t, dry_run)
            if scanned:
                logger.info("  %s.%s: scanned=%d encrypted=%d",
                            t.table, t.token_col, scanned, encrypted)
            total_scanned += scanned
            total_encrypted += encrypted
        if not dry_run:
            await session.commit()

    logger.info("")
    logger.info("Done. scanned=%d encrypted=%d%s",
                total_scanned, total_encrypted, " (no writes — dry-run)" if dry_run else "")
    if total_scanned == 0:
        logger.info("Nothing to do — all tokens are already encrypted.")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Scan only — do not write.")
    args = parser.parse_args()
    sys.exit(asyncio.run(main(dry_run=args.dry_run)))
