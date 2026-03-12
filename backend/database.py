from sqlmodel import SQLModel, Session, create_engine, text
from config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

with engine.connect() as conn:
    conn.execute(text("PRAGMA journal_mode=WAL"))


def init_db() -> None:
    """Create all tables and seed default data."""
    from models import (  # noqa: F401 — imported to register SQLModel metadata
        UserProfile, Watchlist, Position, Trade, PortfolioSnapshot, ChatMessage
    )
    from models.seed import seed_data

    SQLModel.metadata.create_all(engine)

    # Migrate: add realized_pnl column if it doesn't exist (existing databases)
    from sqlalchemy.exc import OperationalError
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE trades ADD COLUMN realized_pnl REAL"))
            conn.commit()
        except OperationalError as e:
            if "duplicate column name" not in str(e):
                raise

    with Session(engine) as session:
        seed_data(session)


def get_session():
    with Session(engine) as session:
        yield session
