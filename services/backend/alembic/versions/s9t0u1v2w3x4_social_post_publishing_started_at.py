"""social_posts: add publishing_started_at for stuck-row watchdog

Revision ID: s9t0u1v2w3x4
Revises: r8s9t0u1v2w3
Create Date: 2026-04-24

Purpose: P2-4. Record when a post was claimed for publishing so a background
watchdog (reap_stuck_publishing) can move rows that never transitioned to
published/failed back to failed. Prevents rows from sitting in `publishing`
state forever after a worker crash.
"""
from alembic import op
import sqlalchemy as sa


revision = "s9t0u1v2w3x4"
down_revision = "r8s9t0u1v2w3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = [c["name"] for c in inspector.get_columns("social_posts")]
    if "publishing_started_at" not in cols:
        op.add_column(
            "social_posts",
            sa.Column(
                "publishing_started_at",
                sa.DateTime(timezone=True),
                nullable=True,
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = [c["name"] for c in inspector.get_columns("social_posts")]
    if "publishing_started_at" in cols:
        op.drop_column("social_posts", "publishing_started_at")
