from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from models import Position, PortfolioSnapshot, Trade, UserProfile
from tasks import take_snapshot

router = APIRouter()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# Request schema for trade endpoint — Pydantic BaseModel, not a DB table.
# Lives here rather than models/ because models/ is reserved for SQLModel table classes.
class TradeRequest(BaseModel):
    ticker: str
    quantity: float
    side: str  # "buy" or "sell"


@router.get("/api/portfolio")
def get_portfolio(request: Request, session: Session = Depends(get_session)):
    user = session.get(UserProfile, "default")
    positions = session.exec(
        select(Position).where(Position.user_id == "default")
    ).all()
    provider = request.app.state.market_provider

    position_data = []
    total_position_value = 0.0
    for pos in positions:
        update = provider.get_price(pos.ticker)
        current_price = update.price if update else pos.avg_cost
        value = pos.quantity * current_price
        unrealized_pnl = (current_price - pos.avg_cost) * pos.quantity
        unrealized_pnl_pct = (current_price - pos.avg_cost) / pos.avg_cost * 100
        total_position_value += value
        position_data.append({
            "ticker": pos.ticker,
            "quantity": pos.quantity,
            "avg_cost": pos.avg_cost,
            "current_price": current_price,
            "value": value,
            "unrealized_pnl": unrealized_pnl,
            "unrealized_pnl_pct": unrealized_pnl_pct,
        })

    cash = user.cash_balance if user else 0.0
    return {
        "cash_balance": cash,
        "total_value": cash + total_position_value,
        "positions": position_data,
    }


@router.post("/api/portfolio/trade", status_code=201)
def execute_trade(
    body: TradeRequest,
    request: Request,
    session: Session = Depends(get_session),
):
    ticker = body.ticker.upper().strip()
    side = body.side.lower()

    if side not in ("buy", "sell"):
        raise HTTPException(status_code=400, detail="side must be 'buy' or 'sell'")
    if body.quantity <= 0:
        raise HTTPException(status_code=400, detail="quantity must be positive")

    provider = request.app.state.market_provider
    update = provider.get_price(ticker)
    if not update:
        raise HTTPException(status_code=404, detail=f"No price data for {ticker}")

    price = update.price
    total_cost = price * body.quantity

    user = session.get(UserProfile, "default")
    if not user:
        raise HTTPException(status_code=500, detail="User profile not found")

    if side == "buy":
        if user.cash_balance < total_cost:
            raise HTTPException(status_code=400, detail="Insufficient cash")

        position = session.exec(
            select(Position).where(
                Position.user_id == "default", Position.ticker == ticker
            )
        ).first()
        if position:
            new_qty = position.quantity + body.quantity
            position.avg_cost = (
                position.quantity * position.avg_cost + total_cost
            ) / new_qty
            position.quantity = new_qty
            position.updated_at = _now()
        else:
            session.add(
                Position(
                    user_id="default",
                    ticker=ticker,
                    quantity=body.quantity,
                    avg_cost=price,
                )
            )
        user.cash_balance -= total_cost

    else:  # sell
        position = session.exec(
            select(Position).where(
                Position.user_id == "default", Position.ticker == ticker
            )
        ).first()
        if not position or position.quantity < body.quantity:
            raise HTTPException(status_code=400, detail="Insufficient shares")

        position.quantity -= body.quantity
        position.updated_at = _now()
        if position.quantity <= 1e-9:
            session.delete(position)
        user.cash_balance += total_cost

    session.add(
        Trade(
            user_id="default",
            ticker=ticker,
            side=side,
            quantity=body.quantity,
            price=price,
        )
    )
    session.commit()

    take_snapshot(provider, request.app.state.engine)

    return {"ticker": ticker, "side": side, "quantity": body.quantity, "price": price, "total": total_cost}


@router.get("/api/portfolio/history")
def get_portfolio_history(session: Session = Depends(get_session)):
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    snapshots = session.exec(
        select(PortfolioSnapshot)
        .where(
            PortfolioSnapshot.user_id == "default",
            PortfolioSnapshot.recorded_at >= cutoff,
        )
        .order_by(PortfolioSnapshot.recorded_at)
    ).all()
    return [
        {"total_value": s.total_value, "recorded_at": s.recorded_at}
        for s in snapshots
    ]
