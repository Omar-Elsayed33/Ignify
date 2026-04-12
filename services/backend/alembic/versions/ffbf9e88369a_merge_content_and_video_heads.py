"""merge_content_and_video_heads

Revision ID: ffbf9e88369a
Revises: c3d4e5f6a7b8, d4e5f6a7b8c9
Create Date: 2026-04-12 18:14:51.439253

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ffbf9e88369a'
down_revision: Union[str, None] = ('c3d4e5f6a7b8', 'd4e5f6a7b8c9')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
