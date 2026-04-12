"""extend seo tables with volume/intent/cpc and serp features

Revision ID: h8c9d0e1f2a3
Revises: g7b8c9d0e1f2, e5f6a7b8c9d0
Create Date: 2026-04-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "h8c9d0e1f2a3"
down_revision: Union[str, Sequence[str], None] = ("g7b8c9d0e1f2", "e5f6a7b8c9d0")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SEOKeyword extensions
    op.add_column("seo_keywords", sa.Column("cpc", sa.Float(), nullable=True))
    op.add_column("seo_keywords", sa.Column("intent", sa.String(length=50), nullable=True))
    op.add_column("seo_keywords", sa.Column("location", sa.String(length=100), nullable=True))
    op.add_column("seo_keywords", sa.Column("language", sa.String(length=10), nullable=True))

    # SEORanking extensions
    op.add_column("seo_rankings", sa.Column("title", sa.String(length=500), nullable=True))
    op.add_column("seo_rankings", sa.Column("serp_features", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("seo_rankings", "serp_features")
    op.drop_column("seo_rankings", "title")
    op.drop_column("seo_keywords", "language")
    op.drop_column("seo_keywords", "location")
    op.drop_column("seo_keywords", "intent")
    op.drop_column("seo_keywords", "cpc")
