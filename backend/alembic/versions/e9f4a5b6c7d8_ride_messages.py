"""Add ride conversations and messages."""

import sqlalchemy as sa

from alembic import op

revision = "e9f4a5b6c7d8"
down_revision = "d8e3f4a5b6c7"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "conversations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ride_id", sa.Integer(), sa.ForeignKey("rides.id"), nullable=False),
        sa.Column("scope", sa.String(40), nullable=False),
        sa.Column("passenger_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("ride_id", "scope", name="uq_conversation_ride_scope"),
    )
    op.create_index("ix_conversations_ride_id", "conversations", ["ride_id"])
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("conversation_id", sa.Integer(), sa.ForeignKey("conversations.id"), nullable=False),
        sa.Column("sender_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_chat_messages_conversation_id_id", "chat_messages", ["conversation_id", "id"])


def downgrade():
    op.drop_table("chat_messages")
    op.drop_table("conversations")
