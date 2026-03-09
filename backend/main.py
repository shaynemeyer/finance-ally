import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select

from database import init_db, engine
from market.factory import create_provider
from models import Watchlist
from routes import health, portfolio, stream, watchlist
from tasks import snapshot_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()

    with Session(engine) as session:
        rows = session.exec(
            select(Watchlist).where(Watchlist.user_id == "default")
        ).all()
        tickers = [row.ticker for row in rows]

    provider = create_provider()
    await provider.start(tickers)
    app.state.market_provider = provider
    app.state.engine = engine

    snapshot_task = asyncio.create_task(snapshot_loop(provider, engine))

    yield

    snapshot_task.cancel()
    await asyncio.gather(snapshot_task, return_exceptions=True)
    await provider.stop()


app = FastAPI(lifespan=lifespan)

app.include_router(health.router)
app.include_router(stream.router)
app.include_router(watchlist.router)
app.include_router(portfolio.router)

_static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(_static_dir):
    app.mount("/", StaticFiles(directory=_static_dir, html=True), name="static")
