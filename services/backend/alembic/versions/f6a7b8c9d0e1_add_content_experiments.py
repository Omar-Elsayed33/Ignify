"""add_content_experiments

Revision ID: f6a7b8c9d0e1
Revises: ffbf9e88369a
Create Date: 2026-04-12 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "ffbf9e88369a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


experiment_status = sa.Enum("draft", "running", "completed", name="experiment_status")


def upgrade() -> None:
    experiment_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "content_experiments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("brief", sa.Text(), nullable=False),
        sa.Column("target", sa.String(length=50), nullable=False, server_default="post"),
        sa.Column("channel", sa.String(length=100), nullable=True),
        sa.Column("language", sa.String(length=10), nullable=False, server_default="ar"),
        sa.Column(
            "status",
            sa.Enum("draft", "running", "completed", name="experiment_status", create_type=False),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("winner_variant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("traffic_split", sa.JSON(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_content_experiments_tenant_id", "content_experiments", ["tenant_id"])

    op.create_table(
        "content_variants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "experiment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("content_experiments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("variant_label", sa.String(length=8), nullable=False),
        sa.Column("content_post_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("content_posts.id"), nullable=True),
        sa.Column("prompt_override", sa.Text(), nullable=True),
        sa.Column("model_override", sa.String(length=128), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("impressions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("clicks", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("engagements", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("conversions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_content_variants_experiment_id", "content_variants", ["experiment_id"])


def downgrade() -> None:
    op.drop_index("ix_content_variants_experiment_id", table_name="content_variants")
    op.drop_table("content_variants")
    op.drop_index("ix_content_experiments_tenant_id", table_name="content_experiments")
    op.drop_table("content_experiments")
    experiment_status.drop(op.get_bind(), checkfirst=True)
