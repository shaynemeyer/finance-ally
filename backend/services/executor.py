"""Auto-execution of trades and watchlist changes from LLM structured response."""
from datetime import datetime, timezone

from sqlmodel import Session, select

from models import Position, Trade, UserProfile, Watchlist


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def execute_trade(session: Session, provider, ticker: str, side: str, quantity: float) -> dict:
    """Execute a trade. Returns {"ok": True, ...} or {"ok": False, "error": "..."}."""
    ticker = ticker.upper().strip()
    side = side.lower()

    if side not in ("buy", "sell"):
        return {"ok": False, "ticker": ticker, "error": "side must be 'buy' or 'sell'"}
    if quantity <= 0:
        return {"ok": False, "ticker": ticker, "error": "quantity must be positive"}

    update = provider.get_price(ticker)
    if not update:
        return {"ok": False, "ticker": ticker, "error": f"No price data for {ticker}"}

    price = update.price
    total_cost = price * quantity

    user = session.get(UserProfile, "default")
    if not user:
        return {"ok": False, "ticker": ticker, "error": "User profile not found"}

    if side == "buy":
        if user.cash_balance < total_cost:
            return {"ok": False, "ticker": ticker, "error": "Insufficient cash"}

        position = session.exec(
            select(Position).where(Position.user_id == "default", Position.ticker == ticker)
        ).first()
        if position:
            new_qty = position.quantity + quantity
            position.avg_cost = (position.quantity * position.avg_cost + total_cost) / new_qty
            position.quantity = new_qty
            position.updated_at = _now()
        else:
            session.add(Position(user_id="default", ticker=ticker, quantity=quantity, avg_cost=price))
        user.cash_balance -= total_cost

    else:  # sell
        position = session.exec(
            select(Position).where(Position.user_id == "default", Position.ticker == ticker)
        ).first()
        if not position or position.quantity < quantity:
            return {"ok": False, "ticker": ticker, "error": "Insufficient shares"}

        position.quantity -= quantity
        position.updated_at = _now()
        if position.quantity <= 1e-6:
            session.delete(position)
        user.cash_balance += total_cost

    session.add(Trade(user_id="default", ticker=ticker, side=side, quantity=quantity, price=price))
    session.commit()
    return {"ok": True, "ticker": ticker, "side": side, "quantity": quantity, "price": price}


def execute_watchlist_change(session: Session, provider, ticker: str, action: str) -> dict:
    """Add or remove a ticker from the watchlist. Returns {"ok": True/False, ...}."""
    ticker = ticker.upper().strip()
    action = action.lower()

    if action not in ("add", "remove"):
        return {"ok": False, "ticker": ticker, "error": "action must be 'add' or 'remove'"}

    if action == "add":
        existing = session.exec(
            select(Watchlist).where(Watchlist.ticker == ticker, Watchlist.user_id == "default")
        ).first()
        if existing:
            return {"ok": True, "ticker": ticker, "action": action, "note": "already in watchlist"}
        session.add(Watchlist(ticker=ticker, user_id="default"))
        session.commit()
        provider.add_ticker(ticker)
        return {"ok": True, "ticker": ticker, "action": action}

    else:  # remove
        row = session.exec(
            select(Watchlist).where(Watchlist.ticker == ticker, Watchlist.user_id == "default")
        ).first()
        if not row:
            return {"ok": True, "ticker": ticker, "action": action, "note": "not in watchlist"}
        session.delete(row)
        session.commit()
        provider.remove_ticker(ticker)
        return {"ok": True, "ticker": ticker, "action": action}
