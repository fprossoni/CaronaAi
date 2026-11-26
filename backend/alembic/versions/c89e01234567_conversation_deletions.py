from alembic import op
import sqlalchemy as sa

revision = "c89e01234567"
down_revision = ("b23c4d5e6f70", "d67e8f901234")
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("conversation_deletions",
        sa.Column("conversation_id", sa.Integer(), sa.ForeignKey("conversations.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True))


def downgrade():
    op.drop_table("conversation_deletions")
