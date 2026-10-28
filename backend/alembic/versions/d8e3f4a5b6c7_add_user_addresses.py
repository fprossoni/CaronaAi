"""add user_addresses table and detailed address fields to matches

Revision ID: d8e3f4a5b6c7
Revises: c7d2e9f1a3b4
Create Date: 2026-10-23 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd8e3f4a5b6c7'
down_revision: Union[str, Sequence[str], None] = 'c7d2e9f1a3b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create user_addresses table for personal saved addresses
    op.create_table(
        'user_addresses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('label', sa.String(length=100), nullable=False),
        sa.Column('street', sa.String(length=200), nullable=False),
        sa.Column('number', sa.String(length=50), nullable=False),
        sa.Column('complement', sa.String(length=100), nullable=True),
        sa.Column('neighborhood', sa.String(length=100), nullable=True),
        sa.Column('postal_code', sa.String(length=20), nullable=False),
        sa.Column('city', sa.String(length=100), nullable=False),
        sa.Column('state', sa.String(length=50), nullable=False),
        sa.Column('country', sa.String(length=50), nullable=False),
        sa.Column('lat', sa.Float(), nullable=False),
        sa.Column('lng', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_addresses_id'), 'user_addresses', ['id'], unique=False)
    op.create_index(op.f('ix_user_addresses_user_id'), 'user_addresses', ['user_id'], unique=False)

    # 2. Add detailed address fields to matches for private storage
    op.add_column('matches', sa.Column('pickup_street', sa.String(length=200), nullable=True))
    op.add_column('matches', sa.Column('pickup_number', sa.String(length=50), nullable=True))
    op.add_column('matches', sa.Column('pickup_complement', sa.String(length=100), nullable=True))
    op.add_column('matches', sa.Column('pickup_postal_code', sa.String(length=20), nullable=True))
    op.add_column('matches', sa.Column('pickup_neighborhood', sa.String(length=100), nullable=True))
    op.add_column('matches', sa.Column('pickup_city', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('matches', 'pickup_city')
    op.drop_column('matches', 'pickup_neighborhood')
    op.drop_column('matches', 'pickup_postal_code')
    op.drop_column('matches', 'pickup_complement')
    op.drop_column('matches', 'pickup_number')
    op.drop_column('matches', 'pickup_street')

    op.drop_index(op.f('ix_user_addresses_user_id'), table_name='user_addresses')
    op.drop_index(op.f('ix_user_addresses_id'), table_name='user_addresses')
    op.drop_table('user_addresses')
