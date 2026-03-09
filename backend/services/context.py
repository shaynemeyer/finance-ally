"""Build portfolio context string for LLM system prompt."""
from sqlmodel import Session, select

from models import Position, UserProfile, Watchlist


def load_portfolio_context(session: Session, provider) -> str:
    """Return a formatted string describing the user's current portfolio state."""
    user = session.get(UserProfile, "default")
    cash = user.cash_balance if user else 0.0

    positions = session.exec(
        select(Position).where(Position.user_id == "default")
    ).all()

    total_value = cash
    position_lines = []
    for pos in positions:
        update = provider.get_price(pos.ticker)
        current_price = update.price if update else pos.avg_cost
        value = pos.quantity * current_price
        unrealized_pnl = (current_price - pos.avg_cost) * pos.quantity
        total_value += value
        position_lines.append(
            f"  {pos.ticker}: qty={pos.quantity}, avg_cost=${pos.avg_cost:.2f}, "
            f"price=${current_price:.2f}, value=${value:.2f}, pnl=${unrealized_pnl:.2f}"
        )

    watchlist_rows = session.exec(
        select(Watchlist).where(Watchlist.user_id == "default")
    ).all()
    watchlist_lines = []
    for row in watchlist_rows:
        update = provider.get_price(row.ticker)
        price_str = f"${update.price:.2f}" if update else "N/A"
        watchlist_lines.append(f"  {row.ticker}: {price_str}")

    lines = [
        f"Cash: ${cash:.2f}",
        f"Total Portfolio Value: ${total_value:.2f}",
        "Positions:" if position_lines else "Positions: none",
    ]
    lines.extend(position_lines)
    lines.append("Watchlist:")
    lines.extend(watchlist_lines)

    return "\n".join(lines)
