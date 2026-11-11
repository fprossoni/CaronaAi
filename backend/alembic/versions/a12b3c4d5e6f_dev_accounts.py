"""Associate development accounts with the browser that created them."""

import sqlalchemy as sa

from alembic import op

revision = "a12b3c4d5e6f"
down_revision = "f01a2b3c4d5e"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("dev_owner_hash", sa.String(64), nullable=True))
    op.create_index("ix_users_dev_owner_hash", "users", ["dev_owner_hash"])


def downgrade():
    op.drop_index("ix_users_dev_owner_hash", table_name="users")
    op.drop_column("users", "dev_owner_hash")
