"""add pgvector + knowledge_chunks table

Revision ID: e5f6a7b8c9d0
Revises: ffbf9e88369a
Create Date: 2026-04-12 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "ffbf9e88369a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector — requires the extension to be available on the PG cluster.
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Use a raw CREATE TABLE to emit the vector(1536) column type without
    # requiring the pgvector SQLAlchemy dialect at migration time.
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS knowledge_chunks (
            id UUID PRIMARY KEY,
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            source VARCHAR(32) NOT NULL DEFAULT 'custom',
            title VARCHAR(512) NOT NULL,
            content TEXT NOT NULL,
            embedding vector(1536),
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.create_index(
        "ix_knowledge_chunks_tenant_id", "knowledge_chunks", ["tenant_id"]
    )
    op.create_index(
        "ix_knowledge_chunks_source", "knowledge_chunks", ["source"]
    )
    # Approximate nearest-neighbour index for cosine similarity search.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_knowledge_chunks_embedding "
        "ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) "
        "WITH (lists = 100)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_knowledge_chunks_embedding")
    op.drop_index("ix_knowledge_chunks_source", table_name="knowledge_chunks")
    op.drop_index("ix_knowledge_chunks_tenant_id", table_name="knowledge_chunks")
    op.execute("DROP TABLE IF EXISTS knowledge_chunks")
    # Leave the pgvector extension in place; other objects may depend on it.
