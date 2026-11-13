"""Allow rides between any two locations."""

import sqlalchemy as sa

from alembic import op

revision = "f01a2b3c4d5e"
down_revision = "e9f4a5b6c7d8"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("rides", "campus_point", existing_type=sa.String(50), nullable=True)


def downgrade():
    op.execute("UPDATE rides SET campus_point = '' WHERE campus_point IS NULL")
    op.alter_column("rides", "campus_point", existing_type=sa.String(50), nullable=False)
