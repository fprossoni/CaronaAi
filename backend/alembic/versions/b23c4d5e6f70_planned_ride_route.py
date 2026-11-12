"""Store the route with confirmed stops separately from the original route."""

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geometry

revision = "b23c4d5e6f70"
down_revision = "a12b3c4d5e6f"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("rides", sa.Column("planned_route_line", Geometry("LINESTRING", srid=4326, spatial_index=False)))
    op.add_column("rides", sa.Column("planned_route", sa.JSON()))
    op.add_column("matches", sa.Column("pickup_after", sa.DateTime(timezone=True)))
    op.add_column("matches", sa.Column("pickup_before", sa.DateTime(timezone=True)))


def downgrade():
    op.drop_column("matches", "pickup_before")
    op.drop_column("matches", "pickup_after")
    op.drop_column("rides", "planned_route")
    op.drop_column("rides", "planned_route_line")
