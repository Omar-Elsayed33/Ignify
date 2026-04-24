"""social_posts: add `publishing` state to enum for atomic scheduler claim

Revision ID: r8s9t0u1v2w3
Revises: q7r8s9t0u1v2
Create Date: 2026-04-24

Purpose: Support an atomic "claim" state transition scheduled → publishing so
two Celery workers (or a duplicate Beat fire) cannot both publish the same
SocialPost row. Part of P1-5 (scheduler race condition fix).
"""
from alembic import op
import sqlalchemy as sa


revision = "r8s9t0u1v2w3"
down_revision = "q7r8s9t0u1v2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL-specific: add the new enum value. ALTER TYPE ... ADD VALUE
    # cannot run inside a transaction on older PG, so use connection.execute
    # with isolation level AUTOCOMMIT.
    bind = op.get_bind()
    # IF NOT EXISTS ensures idempotency for re-runs / DEBUG auto-create.
    bind.execute(sa.text("ALTER TYPE socialpoststatus ADD VALUE IF NOT EXISTS 'publishing'"))


def downgrade() -> None:
    # PostgreSQL doesn't support removing enum values cleanly.
    # If a downgrade is necessary, the operator must:
    #   1. Update any rows with status='publishing' → 'scheduled' or 'failed'
    #   2. Manually DROP and recreate the enum without that value.
    # This is intentional — rolling back an enum value should be a deliberate
    # admin action, not an automated downgrade.
    pass
