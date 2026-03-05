from sqlmodel import Session, select
from model.models import UserProfile, Watchlist

DEFAULT_TICKERS = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"]


def seed_data(session: Session) -> None:
    """Seed default user profile and watchlist if not already present."""
    user = session.get(UserProfile, "default")
    if not user:
        session.add(UserProfile(id="default", cash_balance=10000.0))

    existing = session.exec(
        select(Watchlist).where(Watchlist.user_id == "default")
    ).all()
    existing_tickers = {w.ticker for w in existing}

    for ticker in DEFAULT_TICKERS:
        if ticker not in existing_tickers:
            session.add(Watchlist(user_id="default", ticker=ticker))

    session.commit()
