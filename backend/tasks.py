import asyncio
from sqlmodel import Session, select

from models import Position, UserProfile, PortfolioSnapshot


def take_snapshot(provider, engine) -> None:
    """Calculate and record current portfolio total value."""
    with Session(engine) as session:
        user = session.get(UserProfile, "default")
        if not user:
            return
        positions = session.exec(
            select(Position).where(Position.user_id == "default")
        ).all()
        total = user.cash_balance
        for pos in positions:
            update = provider.get_price(pos.ticker)
            price = update.price if update else pos.avg_cost
            total += pos.quantity * price
        session.add(PortfolioSnapshot(user_id="default", total_value=total))
        session.commit()


async def snapshot_loop(provider, engine) -> None:
    """Record portfolio value snapshot every 10 seconds."""
    while True:
        await asyncio.sleep(10)
        take_snapshot(provider, engine)
