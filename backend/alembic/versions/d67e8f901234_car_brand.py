"""Store the vehicle brand separately from its model."""
import sqlalchemy as sa
from alembic import op
revision = "d67e8f901234"
down_revision = "c56d7e8f9012"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("car_brand", sa.String(100), nullable=True))


def downgrade():
    op.drop_column("users", "car_brand")
