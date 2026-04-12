"""add_content_templates_activities_and_statuses

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-04-12 00:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Extend ContentStatus enum with review/approved/rejected
    # Postgres: add values to enum if not present
    op.execute("ALTER TYPE contentstatus ADD VALUE IF NOT EXISTS 'review'")
    op.execute("ALTER TYPE contentstatus ADD VALUE IF NOT EXISTS 'approved'")
    op.execute("ALTER TYPE contentstatus ADD VALUE IF NOT EXISTS 'rejected'")

    op.create_table(
        'content_templates',
        sa.Column('id', sa.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', sa.UUID(as_uuid=True), sa.ForeignKey('tenants.id'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('type', sa.String(length=50), nullable=False, server_default='post'),
        sa.Column('channel', sa.String(length=100), nullable=True),
        sa.Column('language', sa.String(length=10), nullable=False, server_default='ar'),
        sa.Column('brief_template', sa.Text(), nullable=True),
        sa.Column('system_prompt', sa.Text(), nullable=True),
        sa.Column('is_favorite', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_by', sa.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_content_templates_tenant_id', 'content_templates', ['tenant_id'])

    op.create_table(
        'content_activities',
        sa.Column('id', sa.UUID(as_uuid=True), primary_key=True),
        sa.Column('content_post_id', sa.UUID(as_uuid=True), sa.ForeignKey('content_posts.id'), nullable=False),
        sa.Column('tenant_id', sa.UUID(as_uuid=True), sa.ForeignKey('tenants.id'), nullable=False),
        sa.Column('user_id', sa.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_content_activities_post_id', 'content_activities', ['content_post_id'])
    op.create_index('ix_content_activities_tenant_id', 'content_activities', ['tenant_id'])


def downgrade() -> None:
    op.drop_index('ix_content_activities_tenant_id', table_name='content_activities')
    op.drop_index('ix_content_activities_post_id', table_name='content_activities')
    op.drop_table('content_activities')
    op.drop_index('ix_content_templates_tenant_id', table_name='content_templates')
    op.drop_table('content_templates')
    # Note: removing values from a PG enum is non-trivial; leaving enum extended.
