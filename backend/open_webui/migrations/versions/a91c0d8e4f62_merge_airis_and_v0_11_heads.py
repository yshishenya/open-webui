"""Merge the Airis and Open WebUI v0.11 migration heads.

Revision ID: a91c0d8e4f62
Revises: f0bd01a18a3d, f8b9c7d1a2e3
Create Date: 2026-08-03 00:00:00.000000
"""

from collections.abc import Sequence

revision: str = 'a91c0d8e4f62'
down_revision: tuple[str, str] = ('f0bd01a18a3d', 'f8b9c7d1a2e3')
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
