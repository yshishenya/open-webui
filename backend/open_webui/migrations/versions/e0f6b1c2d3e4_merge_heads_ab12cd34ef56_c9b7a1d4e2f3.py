"""Merge heads ab12cd34ef56 and c9b7a1d4e2f3.

Revision ID: e0f6b1c2d3e4
Revises: ab12cd34ef56, c9b7a1d4e2f3
Create Date: 2026-01-21 00:00:00.000000
"""

from alembic import op

revision = "e0f6b1c2d3e4"
down_revision = ("ab12cd34ef56", "c9b7a1d4e2f3")
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
