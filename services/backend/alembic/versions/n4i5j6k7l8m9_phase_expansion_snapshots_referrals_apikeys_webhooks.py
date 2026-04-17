"""Phase expansion: plan snapshots + share + referrals + api keys + webhooks + nullable social_account_id

Revision ID: n4i5j6k7l8m9
Revises: m3h4i5j6k7l8
Create Date: 2026-04-17 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "n4i5j6k7l8m9"
down_revision: Union[str, Sequence[str], None] = "m3h4i5j6k7l8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── marketing_plans: share_token + share_expires_at ──
    op.add_column(
        "marketing_plans",
        sa.Column("share_token", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "marketing_plans",
        sa.Column("share_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_marketing_plans_share_token",
        "marketing_plans",
        ["share_token"],
        unique=True,
    )

    # ── social_posts: make social_account_id nullable + add platform column ──
    op.alter_column(
        "social_posts",
        "social_account_id",
        existing_type=sa.UUID(as_uuid=True),
        nullable=True,
    )
    op.add_column(
        "social_posts",
        sa.Column(
            "platform",
            sa.Enum(
                "facebook", "instagram", "twitter", "linkedin",
                "tiktok", "youtube", "snapchat",
                name="socialplatform",
                create_type=False,
            ),
            nullable=True,
        ),
    )
    op.create_index("ix_social_posts_platform", "social_posts", ["platform"])

    # ── marketing_plan_snapshots ──
    op.create_table(
        "marketing_plan_snapshots",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "plan_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("marketing_plans.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "tenant_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("created_by", sa.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_marketing_plan_snapshots_plan_id", "marketing_plan_snapshots", ["plan_id"])
    op.create_index("ix_marketing_plan_snapshots_tenant_id", "marketing_plan_snapshots", ["tenant_id"])

    # ── referrals ──
    op.create_table(
        "referrals",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "referrer_user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "referrer_tenant_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("code", sa.String(length=32), nullable=False, unique=True),
        sa.Column(
            "referred_user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "referred_tenant_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("reward", sa.JSON(), nullable=True),
        sa.Column("converted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_referrals_referrer_user_id", "referrals", ["referrer_user_id"])
    op.create_index("ix_referrals_referrer_tenant_id", "referrals", ["referrer_tenant_id"])
    op.create_index("ix_referrals_code", "referrals", ["code"], unique=True)

    # ── api_keys ──
    op.create_table(
        "api_keys",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_by", sa.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("prefix", sa.String(length=24), nullable=False),
        sa.Column("key_hash", sa.String(length=255), nullable=False),
        sa.Column("scope", sa.String(length=32), nullable=False, server_default="read"),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_api_keys_tenant_id", "api_keys", ["tenant_id"])
    op.create_index("ix_api_keys_prefix", "api_keys", ["prefix"])

    # ── webhooks ──
    op.create_table(
        "webhooks",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("url", sa.String(length=2000), nullable=False),
        sa.Column("events", sa.JSON(), nullable=False),
        sa.Column("secret", sa.String(length=64), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_delivery_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_status_code", sa.Integer(), nullable=True),
        sa.Column("created_by", sa.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_webhooks_tenant_id", "webhooks", ["tenant_id"])


def downgrade() -> None:
    op.drop_index("ix_webhooks_tenant_id", table_name="webhooks")
    op.drop_table("webhooks")

    op.drop_index("ix_api_keys_prefix", table_name="api_keys")
    op.drop_index("ix_api_keys_tenant_id", table_name="api_keys")
    op.drop_table("api_keys")

    op.drop_index("ix_referrals_code", table_name="referrals")
    op.drop_index("ix_referrals_referrer_tenant_id", table_name="referrals")
    op.drop_index("ix_referrals_referrer_user_id", table_name="referrals")
    op.drop_table("referrals")

    op.drop_index("ix_marketing_plan_snapshots_tenant_id", table_name="marketing_plan_snapshots")
    op.drop_index("ix_marketing_plan_snapshots_plan_id", table_name="marketing_plan_snapshots")
    op.drop_table("marketing_plan_snapshots")

    op.drop_index("ix_social_posts_platform", table_name="social_posts")
    op.drop_column("social_posts", "platform")
    op.alter_column(
        "social_posts",
        "social_account_id",
        existing_type=sa.UUID(as_uuid=True),
        nullable=False,
    )

    op.drop_index("ix_marketing_plans_share_token", table_name="marketing_plans")
    op.drop_column("marketing_plans", "share_expires_at")
    op.drop_column("marketing_plans", "share_token")
