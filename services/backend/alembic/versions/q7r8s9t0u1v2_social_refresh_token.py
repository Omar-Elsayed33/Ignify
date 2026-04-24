"""social_accounts: add refresh_token_encrypted + token_expires_at

Revision ID: q7r8s9t0u1v2
Revises: p6q7r8s9t0u1
Create Date: 2026-04-24

Purpose: Fix LinkedIn (and future refresh-capable connectors) silently dropping
refresh tokens because no DB column existed. Adds:
- social_accounts.refresh_token_encrypted (Fernet ciphertext, nullable)
- social_accounts.token_expires_at (when the access token expires)
Both are nullable so existing rows remain valid.
"""
from alembic import op
import sqlalchemy as sa


revision = "q7r8s9t0u1v2"
down_revision = "p6q7r8s9t0u1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = [c["name"] for c in inspector.get_columns("social_accounts")]

    if "refresh_token_encrypted" not in existing_cols:
        op.add_column(
            "social_accounts",
            sa.Column("refresh_token_encrypted", sa.String(length=2000), nullable=True),
        )

    if "token_expires_at" not in existing_cols:
        op.add_column(
            "social_accounts",
            sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = [c["name"] for c in inspector.get_columns("social_accounts")]

    if "token_expires_at" in existing_cols:
        op.drop_column("social_accounts", "token_expires_at")
    if "refresh_token_encrypted" in existing_cols:
        op.drop_column("social_accounts", "refresh_token_encrypted")
