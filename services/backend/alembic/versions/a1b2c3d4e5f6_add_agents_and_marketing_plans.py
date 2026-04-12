"""add_agents_and_marketing_plans

Revision ID: a1b2c3d4e5f6
Revises: db3a7c3ea048
Create Date: 2026-04-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'db3a7c3ea048'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'marketing_plans',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('tenant_id', UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('period_start', sa.Date(), nullable=True),
        sa.Column('period_end', sa.Date(), nullable=True),
        sa.Column('goals', sa.JSON(), nullable=True),
        sa.Column('personas', sa.JSON(), nullable=True),
        sa.Column('channels', sa.JSON(), nullable=True),
        sa.Column('calendar', sa.JSON(), nullable=True),
        sa.Column('kpis', sa.JSON(), nullable=True),
        sa.Column('market_analysis', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='draft'),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_by', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
    )
    op.create_index('ix_marketing_plans_tenant_id', 'marketing_plans', ['tenant_id'])

    op.create_table(
        'agent_runs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('tenant_id', UUID(as_uuid=True), nullable=False),
        sa.Column('agent_name', sa.String(length=64), nullable=False),
        sa.Column('thread_id', sa.String(length=255), nullable=True),
        sa.Column('model', sa.String(length=128), nullable=True),
        sa.Column('input', sa.JSON(), nullable=True),
        sa.Column('output', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='pending'),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('input_tokens', sa.Integer(), nullable=True),
        sa.Column('output_tokens', sa.Integer(), nullable=True),
        sa.Column('cost_usd', sa.Numeric(10, 6), nullable=True),
        sa.Column('latency_ms', sa.Integer(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
    )
    op.create_index('ix_agent_runs_tenant_id', 'agent_runs', ['tenant_id'])
    op.create_index('ix_agent_runs_agent_name', 'agent_runs', ['agent_name'])

    op.create_table(
        'tenant_agent_configs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('tenant_id', UUID(as_uuid=True), nullable=False),
        sa.Column('agent_name', sa.String(length=64), nullable=False),
        sa.Column('model', sa.String(length=128), nullable=True),
        sa.Column('system_prompt', sa.Text(), nullable=True),
        sa.Column('temperature', sa.Float(), nullable=True),
        sa.Column('enabled_subagents', sa.JSON(), nullable=True),
        sa.Column('max_tokens', sa.Integer(), nullable=True),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.UniqueConstraint('tenant_id', 'agent_name', name='uq_tenant_agent'),
    )
    op.create_index('ix_tenant_agent_configs_tenant_id', 'tenant_agent_configs', ['tenant_id'])


def downgrade() -> None:
    op.drop_index('ix_tenant_agent_configs_tenant_id', table_name='tenant_agent_configs')
    op.drop_table('tenant_agent_configs')
    op.drop_index('ix_agent_runs_agent_name', table_name='agent_runs')
    op.drop_index('ix_agent_runs_tenant_id', table_name='agent_runs')
    op.drop_table('agent_runs')
    op.drop_index('ix_marketing_plans_tenant_id', table_name='marketing_plans')
    op.drop_table('marketing_plans')
