from sqlmodel import SQLModel, Session, create_engine
from config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def init_db() -> None:
    """Create all tables and seed default data."""
    from models import (  # noqa: F401 — imported to register SQLModel metadata
        UserProfile, Watchlist, Position, Trade, PortfolioSnapshot, ChatMessage
    )
    from models.seed import seed_data

    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        seed_data(session)


def get_session():
    with Session(engine) as session:
        yield session
