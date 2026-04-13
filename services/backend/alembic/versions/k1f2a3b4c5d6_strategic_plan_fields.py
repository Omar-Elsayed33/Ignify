"""add strategic plan fields to marketing_plans

Revision ID: k1f2a3b4c5d6
Revises: j0e1f2a3b4c5
Create Date: 2026-04-12 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "k1f2a3b4c5d6"
down_revision: Union[str, Sequence[str], None] = "j0e1f2a3b4c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_JSON_COLS = [
    "positioning",
    "customer_journey",
    "offer",
    "funnel",
    "conversion",
    "retention",
    "growth_loops",
    "execution_roadmap",
]


def upgrade() -> None:
    for col in _JSON_COLS:
        op.add_column(
            "marketing_plans",
            sa.Column(col, sa.JSON(), nullable=True),
        )
    op.add_column(
        "marketing_plans",
        sa.Column("budget_monthly_usd", sa.Numeric(10, 2), nullable=True),
    )
    op.add_column(
        "marketing_plans",
        sa.Column("primary_goal", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    for col in _JSON_COLS:
        op.drop_column("marketing_plans", col)
    op.drop_column("marketing_plans", "budget_monthly_usd")
    op.drop_column("marketing_plans", "primary_goal")
