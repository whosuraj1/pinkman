"""Database engine + session helpers."""
from sqlmodel import Session, SQLModel, create_engine

from config import settings

# check_same_thread=False is required for SQLite + FastAPI background tasks.
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, echo=False, connect_args=connect_args)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    _run_lightweight_migrations()


def _run_lightweight_migrations() -> None:
    """Add any newly-introduced columns to existing SQLite tables.

    SQLModel.create_all() only creates missing *tables*, not missing *columns*.
    For this prototype (SQLite, no Alembic) we add columns in place so an existing
    database keeps its data across feature updates.
    """
    from sqlalchemy import text

    # column_name -> SQL type/default to add if missing, per table
    wanted = {
        "batch": {
            "has_template": "BOOLEAN DEFAULT 0",
            "completed_file_path": "VARCHAR",
            "completed_filename": "VARCHAR",
        },
    }
    with engine.begin() as conn:
        for table, cols in wanted.items():
            existing = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
            for col, decl in cols.items():
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {decl}"))


def get_session():
    with Session(engine) as session:
        yield session
