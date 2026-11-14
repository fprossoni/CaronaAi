"""Store desired and offered boarding times; preserve legacy agreements."""
import sqlalchemy as sa
from alembic import op

revision = "d45e6f708192"
down_revision = "c34d5e6f7081"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("matches", sa.Column("desired_pickup_at", sa.DateTime(timezone=True)))
    op.add_column("matches", sa.Column("offered_pickup_at", sa.DateTime(timezone=True)))


def downgrade():
    op.drop_column("matches", "offered_pickup_at")
    op.drop_column("matches", "desired_pickup_at")
