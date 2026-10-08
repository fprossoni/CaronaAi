"""add profile fields: bio, campuses, car_color

Revision ID: b3f1a2c4e5d6
Revises: 5ab8c88f97fc
Create Date: 2026-10-08 14:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3f1a2c4e5d6'
down_revision: Union[str, Sequence[str], None] = '5ab8c88f97fc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('bio', sa.String(length=300), nullable=True))
    op.add_column('users', sa.Column('campuses', sa.JSON(), nullable=True))
    op.add_column('users', sa.Column('car_color', sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'car_color')
    op.drop_column('users', 'campuses')
    op.drop_column('users', 'bio')
