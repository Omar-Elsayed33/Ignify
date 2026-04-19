"""Add tenant_ai_config table for per-tenant OpenRouter sub-key management

Revision ID: o5p6q7r8s9t0
Revises: n4i5j6k7l8m9
Create Date: 2026-04-19 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "o5p6q7r8s9t0"
down_revision: Union[str, Sequence[str], None] = "n4i5j6k7l8m9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tenant_ai_config",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("openrouter_key_id", sa.String(128), nullable=True),
        sa.Column("openrouter_key_encrypted", sa.Text, nullable=True),
        sa.Column("monthly_limit_usd", sa.Numeric(10, 4), nullable=False, server_default="2.5000"),
        sa.Column("usage_usd", sa.Numeric(10, 4), nullable=False, server_default="0.0000"),
        sa.Column("usage_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reset_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("tenant_ai_config")
