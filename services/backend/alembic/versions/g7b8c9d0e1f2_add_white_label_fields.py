"""add_white_label_fields

Revision ID: g7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-04-12 19:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "g7b8c9d0e1f2"
down_revision: Union[str, None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("brand_settings", sa.Column("white_label_enabled", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("brand_settings", sa.Column("custom_domain", sa.String(length=255), nullable=True))
    op.add_column("brand_settings", sa.Column("custom_domain_verified", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("brand_settings", sa.Column("app_name", sa.String(length=255), nullable=True))
    op.add_column("brand_settings", sa.Column("favicon_url", sa.String(length=1000), nullable=True))
    op.add_column("brand_settings", sa.Column("email_sender_name", sa.String(length=255), nullable=True))
    op.add_column("brand_settings", sa.Column("email_sender_address", sa.String(length=255), nullable=True))
    op.add_column("brand_settings", sa.Column("footer_text", sa.Text(), nullable=True))
    op.add_column("brand_settings", sa.Column("support_email", sa.String(length=255), nullable=True))
    op.add_column("brand_settings", sa.Column("support_url", sa.String(length=1000), nullable=True))
    op.add_column("brand_settings", sa.Column("hide_powered_by", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_unique_constraint("uq_brand_settings_custom_domain", "brand_settings", ["custom_domain"])
    op.create_index("ix_brand_settings_custom_domain", "brand_settings", ["custom_domain"])


def downgrade() -> None:
    op.drop_index("ix_brand_settings_custom_domain", table_name="brand_settings")
    op.drop_constraint("uq_brand_settings_custom_domain", "brand_settings", type_="unique")
    for col in [
        "hide_powered_by",
        "support_url",
        "support_email",
        "footer_text",
        "email_sender_address",
        "email_sender_name",
        "favicon_url",
        "app_name",
        "custom_domain_verified",
        "custom_domain",
        "white_label_enabled",
    ]:
        op.drop_column("brand_settings", col)
