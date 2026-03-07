from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from models import Watchlist

router = APIRouter()


class AddTickerRequest(BaseModel):
    ticker: str


@router.get("/api/watchlist")
def get_watchlist(request: Request, session: Session = Depends(get_session)):
    rows = session.exec(
        select(Watchlist).where(Watchlist.user_id == "default")
    ).all()
    provider = request.app.state.market_provider
    result = []
    for row in rows:
        update = provider.get_price(row.ticker)
        result.append({
            "ticker": row.ticker,
            "added_at": row.added_at,
            "price": update.price if update else None,
            "change": update.change if update else None,
            "change_pct": update.change_pct if update else None,
        })
    return result


@router.post("/api/watchlist", status_code=201)
def add_ticker(
    body: AddTickerRequest,
    request: Request,
    session: Session = Depends(get_session),
):
    ticker = body.ticker.upper().strip()
    existing = session.exec(
        select(Watchlist).where(Watchlist.ticker == ticker, Watchlist.user_id == "default")
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Ticker already in watchlist")

    entry = Watchlist(ticker=ticker, user_id="default")
    session.add(entry)
    session.commit()

    request.app.state.market_provider.add_ticker(ticker)
    return {"ticker": ticker}


@router.delete("/api/watchlist/{ticker}")
def remove_ticker(
    ticker: str,
    request: Request,
    session: Session = Depends(get_session),
):
    ticker = ticker.upper()
    row = session.exec(
        select(Watchlist).where(Watchlist.ticker == ticker, Watchlist.user_id == "default")
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Ticker not found")

    session.delete(row)
    session.commit()

    request.app.state.market_provider.remove_ticker(ticker)
    return {"ticker": ticker}
