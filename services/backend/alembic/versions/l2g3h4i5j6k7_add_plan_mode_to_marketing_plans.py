"""add plan_mode column to marketing_plans

Revision ID: l2g3h4i5j6k7
Revises: k1f2a3b4c5d6
Create Date: 2026-04-13 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "l2g3h4i5j6k7"
down_revision: Union[str, Sequence[str], None] = "k1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "marketing_plans",
        sa.Column(
            "plan_mode",
            sa.String(length=20),
            nullable=False,
            server_default="fast",
        ),
    )


def downgrade() -> None:
    op.drop_column("marketing_plans", "plan_mode")
