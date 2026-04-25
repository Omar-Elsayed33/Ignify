"""admin_settings: platform-wide singleton key/value store

Revision ID: t0u1v2w3x4y5
Revises: s9t0u1v2w3x4
Create Date: 2026-04-25

Purpose:
Phase 12 — move OPENROUTER_MANAGER_KEY out of .env into admin-managed,
encrypted DB storage. The key changes through admin action (rotation),
not deployment, so it belongs in the DB. Stored encrypted via Fernet
(same crypto as social tokens).

The table is intentionally a generic key/value shape so we can store
other admin-managed secrets (Sentry DSN override, Stripe secret, etc.)
without further migrations. Each row holds a single setting.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "t0u1v2w3x4y5"
down_revision = "s9t0u1v2w3x4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "admin_settings" in inspector.get_table_names():
        return  # idempotent — already created by DEBUG auto-create

    op.create_table(
        "admin_settings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        # Stable string key — e.g. "openrouter.manager_key"
        sa.Column("key", sa.String(length=128), nullable=False, unique=True),
        # Fernet ciphertext for sensitive values; plain text OK for non-sensitive.
        # Always store SOMETHING here so callers can detect "set" vs "unset" by
        # checking is_secret + value emptiness.
        sa.Column("value", sa.Text, nullable=True),
        sa.Column("is_secret", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_admin_settings_key", "admin_settings", ["key"], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "admin_settings" not in inspector.get_table_names():
        return
    op.drop_index("ix_admin_settings_key", table_name="admin_settings")
    op.drop_table("admin_settings")
