"""multi-matching: birth_date, instagram, match batch_id, SUPERSEDED status

Revision ID: c7d2e9f1a3b4
Revises: b3f1a2c4e5d6
Create Date: 2026-10-23 20:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7d2e9f1a3b4'
down_revision: Union[str, Sequence[str], None] = 'b3f1a2c4e5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users — public profile shown in matching lists
    op.add_column('users', sa.Column('birth_date', sa.Date(), nullable=True))
    op.add_column('users', sa.Column('instagram', sa.String(length=100), nullable=True))

    # Matches — group requests sent together
    op.add_column('matches', sa.Column('batch_id', sa.String(length=36), nullable=True))
    op.create_index(op.f('ix_matches_batch_id'), 'matches', ['batch_id'], unique=False)

    # New enum value (SQLAlchemy stores enum *names*, hence uppercase).
    # ADD VALUE cannot run inside a transaction block on older PostgreSQL versions.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE matchstatus ADD VALUE IF NOT EXISTS 'SUPERSEDED'")


def downgrade() -> None:
    # PostgreSQL cannot drop enum values; move rows back to CANCELLED instead.
    op.execute("UPDATE matches SET status = 'CANCELLED' WHERE status = 'SUPERSEDED'")
    op.drop_index(op.f('ix_matches_batch_id'), table_name='matches')
    op.drop_column('matches', 'batch_id')
    op.drop_column('users', 'instagram')
    op.drop_column('users', 'birth_date')
