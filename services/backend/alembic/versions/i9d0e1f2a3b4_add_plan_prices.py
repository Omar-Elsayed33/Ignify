"""add plan prices (per-currency) and is_active toggle

Revision ID: i9d0e1f2a3b4
Revises: h8c9d0e1f2a3
Create Date: 2026-04-12 00:00:00.000000

"""
import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "i9d0e1f2a3b4"
down_revision: Union[str, Sequence[str], None] = "h8c9d0e1f2a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Country → currency mapping mirrors app.modules.geo.router
FX_FROM_USD = {
    "USD": 1.0,
    "EGP": 50.0,
    "SAR": 3.75,
    "AED": 3.67,
}


def upgrade() -> None:
    op.add_column(
        "plans",
        sa.Column("prices", sa.JSON(), nullable=True),
    )
    op.add_column(
        "plans",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    # Backfill prices from existing price_monthly (assumed USD).
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, price_monthly FROM plans")).fetchall()
    for row in rows:
        pid = row[0]
        monthly_usd = float(row[1] or 0)
        yearly_usd = round(monthly_usd * 10, 2)  # 2 months free
        prices = {
            cur: {
                "monthly": round(monthly_usd * rate, 2),
                "yearly": round(yearly_usd * rate, 2),
            }
            for cur, rate in FX_FROM_USD.items()
        }
        # JSON columns accept a string on most dialects (SQLite stores as text;
        # PostgreSQL JSON accepts text literals too).
        conn.execute(
            sa.text("UPDATE plans SET prices = :p WHERE id = :id"),
            {"p": json.dumps(prices), "id": pid},
        )


def downgrade() -> None:
    op.drop_column("plans", "is_active")
    op.drop_column("plans", "prices")
