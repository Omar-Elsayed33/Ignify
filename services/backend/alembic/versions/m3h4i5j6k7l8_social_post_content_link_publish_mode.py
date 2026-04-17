"""add content_post_id and publish_mode to social_posts

Revision ID: m3h4i5j6k7l8
Revises: l2g3h4i5j6k7
Create Date: 2026-04-14 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "m3h4i5j6k7l8"
down_revision: Union[str, Sequence[str], None] = "l2g3h4i5j6k7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "social_posts",
        sa.Column("content_post_id", sa.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "social_posts_content_post_id_fkey",
        "social_posts",
        "content_posts",
        ["content_post_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "social_posts",
        sa.Column(
            "publish_mode",
            sa.String(length=16),
            nullable=False,
            server_default="auto",
        ),
    )
    op.create_index(
        "ix_social_posts_content_post_id",
        "social_posts",
        ["content_post_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_social_posts_content_post_id", table_name="social_posts")
    op.drop_column("social_posts", "publish_mode")
    op.drop_constraint(
        "social_posts_content_post_id_fkey", "social_posts", type_="foreignkey"
    )
    op.drop_column("social_posts", "content_post_id")
