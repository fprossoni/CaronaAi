"""Separate verification and password recovery codes."""
from alembic import op
import sqlalchemy as sa

revision = "c56d7e8f9012"
down_revision = "d45e6f708192"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("auth_version", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("email_verification_tokens", sa.Column("purpose", sa.String(20), nullable=False, server_default="verification"))
    op.add_column("email_verification_tokens", sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"))


def downgrade():
    op.drop_column("users", "auth_version")
    op.drop_column("email_verification_tokens", "attempts")
    op.drop_column("email_verification_tokens", "purpose")
