"""Create media inbox tables.

Run with:
    python -m app.db.migrations.create_media_inbox_tables
"""

from sqlalchemy import text

from app.db.session import engine


def upgrade() -> None:
    statements = [
        """
        CREATE TABLE IF NOT EXISTS media_inbox_items (
            id SERIAL PRIMARY KEY,
            filename TEXT NULL,
            webp_path TEXT NOT NULL,
            draft_title TEXT NULL,
            draft_description TEXT NULL,
            product_type TEXT NULL,
            combined_tags JSON NULL,
            status TEXT NOT NULL,
            assigned_product_id INT NULL,
            assigned_variant_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS media_second_inbox_items (
            id SERIAL PRIMARY KEY,
            webp_path TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
    ]

    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))


def main() -> None:
    upgrade()


if __name__ == "__main__":
    main()
