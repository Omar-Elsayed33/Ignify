"""add_video_asset_type

Revision ID: d4e5f6a7b8c9
Revises: b2c3d4e5f6a7
Create Date: 2026-04-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PostgreSQL: add new value to existing enum type
    op.execute("ALTER TYPE assettype ADD VALUE IF NOT EXISTS 'video'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values cleanly; no-op.
    pass
