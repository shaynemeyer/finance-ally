# Market Data Backend Design

**Ticket**: FA-3
**Status**: Design complete — ready for implementation

This document consolidates `MARKET_INTERFACE.md`, `MARKET_SIMULATOR.md`, `MASSIVE_API.md`, and
`PLAN.md` into a single implementation contract. An engineer can implement market data end-to-end
from this document alone.

---

## 1. Abstract Interface

All market data sources implement `MarketDataProvider`. Both `SimulatorProvider` and
`MassiveProvider` are concrete subclasses. All downstream code (SSE, watchlist routes) uses
only the abstract interface.

### 1.1 PriceUpdate data class

```python
# backend/market/types.py

from dataclasses import dataclass


@dataclass
class PriceUpdate:
    ticker: str
    price: float
    prev_price: float    # price from previous emission for this ticker
    prev_close: float    # session-open price (sim: seed price; real: prevDay.c)
    timestamp: float     # Unix timestamp (seconds)
    change: float        # price - prev_close
    change_pct: float    # (price - prev_close) / prev_close * 100
```

### 1.2 Abstract base class

```python
# backend/market/base.py

from abc import ABC, abstractmethod
from .types import PriceUpdate


class MarketDataProvider(ABC):
    """Abstract base for market data sources."""

    @abstractmethod
    async def start(self, tickers: list[str]) -> None:
        """Start background polling/simulation for the given tickers."""
        ...

    @abstractmethod
    async def stop(self) -> None:
        """Stop background task and release resources."""
        ...

    @abstractmethod
    def add_ticker(self, ticker: str) -> None:
        """Add a ticker to the active set. Takes effect on next poll/tick."""
        ...

    @abstractmethod
    def remove_ticker(self, ticker: str) -> None:
        """Remove a ticker from the active set and delete it from the cache."""
        ...

    @abstractmethod
    def get_price(self, ticker: str) -> PriceUpdate | None:
        """Return the latest cached PriceUpdate for a ticker, or None."""
        ...

    @abstractmethod
    def get_all_prices(self) -> dict[str, PriceUpdate]:
        """Return the full price cache: {ticker: PriceUpdate}."""
        ...
```

---

## 2. Shared Price Cache

Each provider owns an internal `_cache: dict[str, PriceUpdate]`. There is no separate cache
layer — the provider IS the cache.

### 2.1 Structure

```python
_cache: dict[str, PriceUpdate] = {}
# Key: uppercase ticker symbol
# Value: latest PriceUpdate written by the background task
```

### 2.2 Thread/async safety

The asyncio event loop is single-threaded. Both the background task (writer) and the SSE
endpoint (reader) run on the same loop. Plain `dict` operations are safe without locks.

No `asyncio.Lock` is required. Do not add one — it creates unnecessary complexity.

### 2.3 Adding and removing tickers

```python
# Adding: provider initialises the ticker and includes it on the next tick/poll
provider.add_ticker("PYPL")

# Removing: provider evicts from cache immediately (synchronous)
provider.remove_ticker("TSLA")
# After this call, get_all_prices() will NOT include TSLA
```

Eviction is synchronous and immediate — the SSE stream will not push a removed ticker on the
next read because `remove_ticker` deletes from `_cache` before returning.

---

## 3. Market Simulator

Default provider when `MASSIVE_API_KEY` is absent or empty.

### 3.1 GBM formula

```
S(t+dt) = S(t) * exp((mu - sigma²/2) * dt + sigma * sqrt(dt) * Z)
```

- `dt = 0.5 / (252 * 6.5 * 3600)` ≈ 1.58e-7 years per tick (500ms at trading hours scale)
- Keeps per-step moves small (±0.1–0.3% typical)

### 3.2 Correlation

One market-wide `Z_market` is drawn per tick. Each ticker mixes it with an idiosyncratic factor:

```
Z_ticker = rho * Z_market + sqrt(1 - rho²) * Z_idiosyncratic
```

| Group       | Tickers                                   | rho |
|-------------|-------------------------------------------|-----|
| Tech/growth | AAPL, GOOGL, MSFT, AMZN, META, NVDA, NFLX | 0.6 |
| High-beta   | TSLA                                      | 0.4 |
| Financials  | JPM, V                                    | 0.3 |
| Unknown     | any dynamically added ticker              | 0.5 |

### 3.3 Random events

```python
EVENT_PROBABILITY = 0.002   # ~1 event per 8 minutes per ticker
EVENT_MIN = 0.02
EVENT_MAX = 0.05
```

### 3.4 Full implementation

```python
# backend/market/simulator.py

import asyncio
import math
import random
import time

from .base import MarketDataProvider
from .types import PriceUpdate

TICK_INTERVAL = 0.5
SECONDS_PER_YEAR = 252 * 6.5 * 3600
DT = TICK_INTERVAL / SECONDS_PER_YEAR

EVENT_PROBABILITY = 0.002
EVENT_MIN = 0.02
EVENT_MAX = 0.05

SEED_PRICES: dict[str, float] = {
    "AAPL":  190.0,
    "GOOGL": 175.0,
    "MSFT":  415.0,
    "AMZN":  185.0,
    "TSLA":  250.0,
    "NVDA":  875.0,
    "META":  505.0,
    "JPM":   195.0,
    "V":     275.0,
    "NFLX":  620.0,
}

TICKER_PARAMS: dict[str, tuple[float, float]] = {
    "AAPL":  (0.08, 0.28),
    "GOOGL": (0.07, 0.30),
    "MSFT":  (0.09, 0.26),
    "AMZN":  (0.10, 0.32),
    "TSLA":  (0.05, 0.65),
    "NVDA":  (0.15, 0.55),
    "META":  (0.10, 0.38),
    "JPM":   (0.06, 0.22),
    "V":     (0.07, 0.20),
    "NFLX":  (0.08, 0.40),
}

TICKER_RHO: dict[str, float] = {
    "AAPL": 0.6, "GOOGL": 0.6, "MSFT": 0.6, "AMZN": 0.6,
    "META": 0.6, "NVDA": 0.6, "NFLX": 0.6,
    "TSLA": 0.4,
    "JPM": 0.3, "V": 0.3,
}

DEFAULT_PARAMS: tuple[float, float] = (0.07, 0.35)
DEFAULT_RHO = 0.5


class SimulatorProvider(MarketDataProvider):
    def __init__(self) -> None:
        self._prices: dict[str, float] = {}
        self._prev_closes: dict[str, float] = {}
        self._cache: dict[str, PriceUpdate] = {}
        self._tickers: set[str] = set()
        self._task: asyncio.Task | None = None

    async def start(self, tickers: list[str]) -> None:
        for ticker in tickers:
            self._init_ticker(ticker)
        self._tickers = {t.upper() for t in tickers}
        self._task = asyncio.create_task(self._tick_loop())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            await asyncio.gather(self._task, return_exceptions=True)

    def add_ticker(self, ticker: str) -> None:
        ticker = ticker.upper()
        if ticker not in self._tickers:
            self._init_ticker(ticker)
            self._tickers.add(ticker)

    def remove_ticker(self, ticker: str) -> None:
        ticker = ticker.upper()
        self._tickers.discard(ticker)
        self._prices.pop(ticker, None)
        self._prev_closes.pop(ticker, None)
        self._cache.pop(ticker, None)

    def get_price(self, ticker: str) -> PriceUpdate | None:
        return self._cache.get(ticker.upper())

    def get_all_prices(self) -> dict[str, PriceUpdate]:
        return dict(self._cache)

    def _init_ticker(self, ticker: str) -> None:
        ticker = ticker.upper()
        seed = SEED_PRICES.get(ticker, 100.0)
        self._prices[ticker] = seed
        self._prev_closes[ticker] = seed

    async def _tick_loop(self) -> None:
        while True:
            self._tick()
            await asyncio.sleep(TICK_INTERVAL)

    def _tick(self) -> None:
        now = time.time()
        z_market = random.gauss(0, 1)

        for ticker in list(self._tickers):
            mu, sigma = TICKER_PARAMS.get(ticker, DEFAULT_PARAMS)
            rho = TICKER_RHO.get(ticker, DEFAULT_RHO)

            z_idio = random.gauss(0, 1)
            z = rho * z_market + math.sqrt(1 - rho ** 2) * z_idio

            drift = (mu - 0.5 * sigma ** 2) * DT
            diffusion = sigma * math.sqrt(DT) * z

            prev_price = self._prices[ticker]
            new_price = prev_price * math.exp(drift + diffusion)
            new_price = _apply_event(new_price)
            new_price = max(new_price, 0.01)

            self._prices[ticker] = new_price

            prev_close = self._prev_closes[ticker]
            change = new_price - prev_close
            change_pct = (change / prev_close * 100) if prev_close else 0.0

            self._cache[ticker] = PriceUpdate(
                ticker=ticker,
                price=round(new_price, 2),
                prev_price=round(prev_price, 2),
                prev_close=round(prev_close, 2),
                timestamp=now,
                change=round(change, 4),
                change_pct=round(change_pct, 4),
            )


def _apply_event(price: float) -> float:
    if random.random() < EVENT_PROBABILITY:
        direction = 1 if random.random() > 0.5 else -1
        magnitude = random.uniform(EVENT_MIN, EVENT_MAX)
        return price * (1 + direction * magnitude)
    return price
```

**Design notes**:

- `prev_close` is set once at `_init_ticker` and never rolled over — it is "price since simulator
  started", which resets on container restart. This is intentional.
- No wall-clock drift correction for `asyncio.sleep(0.5)` — acceptable for a simulator.
- Price floor of `$0.01` prevents GBM from reaching zero.
- Unknown tickers (dynamically added) fall back to seed price `$100.0`.

---

## 4. Massive API Client

Used when `MASSIVE_API_KEY` is set. Polls the Polygon.io REST API (Polygon rebranded as Massive
on 2025-10-30; existing API keys continue to work at `https://api.polygon.io`).

### 4.1 Polling strategy

One call to `/v2/snapshot/locale/us/markets/stocks/tickers` fetches all watched tickers in a
single request. Free tier allows 5 requests/minute → poll every 15 seconds. This is configurable
via `MASSIVE_POLL_INTERVAL` environment variable.

Add to `backend/config.py`:

```python
MASSIVE_POLL_INTERVAL = float(os.getenv("MASSIVE_POLL_INTERVAL", "15.0"))
```

### 4.2 Daily change baseline

For `MassiveProvider`, `prev_close` is seeded from `prevDay.c` on first poll. This gives a
meaningful daily change % using real data. For `SimulatorProvider`, `prev_close` is the seed
price (simulator session baseline). Both use the same `change` / `change_pct` fields in
`PriceUpdate` — the frontend treats them identically.

### 4.3 Full implementation

```python
# backend/market/massive.py

import asyncio
import time
import httpx

from config import MASSIVE_POLL_INTERVAL
from .base import MarketDataProvider
from .types import PriceUpdate

BASE_URL = "https://api.polygon.io"


class MassiveProvider(MarketDataProvider):
    def __init__(self, api_key: str) -> None:
        self._api_key = api_key
        self._tickers: set[str] = set()
        self._cache: dict[str, PriceUpdate] = {}
        self._prev_closes: dict[str, float] = {}
        self._task: asyncio.Task | None = None

    async def start(self, tickers: list[str]) -> None:
        self._tickers = {t.upper() for t in tickers}
        self._task = asyncio.create_task(self._poll_loop())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            await asyncio.gather(self._task, return_exceptions=True)

    def add_ticker(self, ticker: str) -> None:
        self._tickers.add(ticker.upper())

    def remove_ticker(self, ticker: str) -> None:
        ticker = ticker.upper()
        self._tickers.discard(ticker)
        self._cache.pop(ticker, None)
        self._prev_closes.pop(ticker, None)

    def get_price(self, ticker: str) -> PriceUpdate | None:
        return self._cache.get(ticker.upper())

    def get_all_prices(self) -> dict[str, PriceUpdate]:
        return dict(self._cache)

    async def _poll_loop(self) -> None:
        while True:
            if self._tickers:
                await self._fetch_snapshot()
            await asyncio.sleep(POLL_INTERVAL)

    async def _fetch_snapshot(self) -> None:
        tickers_param = ",".join(sorted(self._tickers))
        url = f"{BASE_URL}/v2/snapshot/locale/us/markets/stocks/tickers"
        now = time.time()

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    url,
                    params={"tickers": tickers_param, "apiKey": self._api_key},
                )
                response.raise_for_status()
                data = response.json()
        except (httpx.HTTPError, ValueError):
            return   # keep stale cache; SSE continues with last known prices

        for item in data.get("tickers", []):
            ticker = item["ticker"]
            last_trade = item.get("lastTrade") or {}
            price = last_trade.get("p") or item["day"]["c"]
            prev_close = item["prevDay"]["c"]

            if ticker not in self._prev_closes:
                self._prev_closes[ticker] = prev_close

            prev_price = self._cache[ticker].price if ticker in self._cache else price
            change = price - prev_close
            change_pct = (change / prev_close * 100) if prev_close else 0.0

            self._cache[ticker] = PriceUpdate(
                ticker=ticker,
                price=price,
                prev_price=prev_price,
                prev_close=prev_close,
                timestamp=now,
                change=round(change, 4),
                change_pct=round(change_pct, 4),
            )
```

**Error handling**: On any HTTP or parse error, log nothing and return — the stale cache is
retained and SSE keeps pushing last known prices. The background task does not crash.

---

## 5. Provider Selection

```python
# backend/market/factory.py

from config import MASSIVE_API_KEY
from .base import MarketDataProvider
from .massive import MassiveProvider
from .simulator import SimulatorProvider


def create_provider() -> MarketDataProvider:
    """Return MassiveProvider if MASSIVE_API_KEY is set, else SimulatorProvider."""
    if MASSIVE_API_KEY:
        return MassiveProvider(api_key=MASSIVE_API_KEY)
    return SimulatorProvider()
```

One provider instance is created at application startup and shared for the lifetime of the
process. It is stored on the FastAPI `app.state` object (see Section 7).

---

## 6. SSE Streaming Endpoint

```python
# backend/routes/stream.py

import asyncio
import json

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

router = APIRouter()

SSE_INTERVAL = 0.5  # seconds between pushes


@router.get("/api/stream/prices")
async def price_stream(request: Request):
    provider = request.app.state.market_provider

    async def event_generator():
        while True:
            if await request.is_disconnected():
                break
            prices = provider.get_all_prices()
            for update in prices.values():
                payload = json.dumps({
                    "ticker": update.ticker,
                    "price": update.price,
                    "prev_price": update.prev_price,
                    "prev_close": update.prev_close,
                    "change": update.change,
                    "change_pct": update.change_pct,
                    "timestamp": update.timestamp,
                })
                yield f"data: {payload}\n\n"
            await asyncio.sleep(SSE_INTERVAL)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
```

**Client disconnect**: `request.is_disconnected()` is checked before each push cycle. When the
client disconnects, the generator breaks and the `StreamingResponse` is garbage-collected.
`EventSource` on the frontend reconnects automatically with built-in retry — no custom
reconnect logic needed in the backend.

**Cadence note**: The SSE endpoint reads the cache every 500ms. `SimulatorProvider` also ticks
every 500ms. There is no guaranteed phase alignment — the SSE reader may read a tick 0–499ms
old. This is acceptable for a live-display application.

---

## 7. Background Task Lifecycle

The provider is started on FastAPI startup and stopped on shutdown using the `lifespan` context
manager. The provider instance is stored on `app.state` so routes can access it via
`request.app.state.market_provider`.

```python
# backend/main.py (excerpt — replace the existing lifespan)

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select

from database import init_db, engine
from market.factory import create_provider
from models import Watchlist
from routes import health, stream


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()

    # Load watchlist tickers from DB
    with Session(engine) as session:
        rows = session.exec(
            select(Watchlist).where(Watchlist.user_id == "default")
        ).all()
        tickers = [row.ticker for row in rows]

    # Start market data provider
    provider = create_provider()
    await provider.start(tickers)
    app.state.market_provider = provider

    yield

    await provider.stop()


app = FastAPI(lifespan=lifespan)

app.include_router(health.router)
app.include_router(stream.router)

_static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(_static_dir):
    app.mount("/", StaticFiles(directory=_static_dir, html=True), name="static")
```

**SQLite WAL mode**: Enable WAL mode at engine creation time to prevent `database is locked`
errors when the portfolio snapshot background task and trade execution write concurrently:

```python
# backend/database.py — update create_engine call

from sqlmodel import SQLModel, Session, create_engine, text
from config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# Enable WAL mode on first connection
with engine.connect() as conn:
    conn.execute(text("PRAGMA journal_mode=WAL"))
```

---

## 8. Watchlist Integration

When the watchlist changes via API, the provider is updated immediately so the SSE stream
reflects the change on the next push cycle.

```python
# backend/routes/watchlist.py (excerpt)

from fastapi import APIRouter, Request, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session
from models import Watchlist

router = APIRouter()


@router.post("/api/watchlist")
async def add_ticker(body: AddTickerRequest, request: Request, session: Session = Depends(get_session)):
    ticker = body.ticker.upper().strip()
    # ... validate and insert into DB ...
    db_entry = Watchlist(ticker=ticker, user_id="default")
    session.add(db_entry)
    session.commit()

    # Update live provider immediately
    request.app.state.market_provider.add_ticker(ticker)
    return {"ticker": ticker}


@router.delete("/api/watchlist/{ticker}")
async def remove_ticker(ticker: str, request: Request, session: Session = Depends(get_session)):
    ticker = ticker.upper()
    # ... validate exists and delete from DB ...
    row = session.exec(select(Watchlist).where(
        Watchlist.ticker == ticker, Watchlist.user_id == "default"
    )).first()
    if not row:
        raise HTTPException(status_code=404, detail="Ticker not found")
    session.delete(row)
    session.commit()

    # Evict from cache immediately — SSE stops pushing on the very next cycle
    request.app.state.market_provider.remove_ticker(ticker)
    return {"ticker": ticker}
```

Cache eviction is synchronous and immediate. There is no race window where a removed ticker
continues to appear in the SSE stream.

---

## 9. File Structure

All market data code lives in `backend/market/`. No other directory is modified by this feature.

```text
backend/
├── main.py               # Updated: lifespan starts/stops provider, registers stream router
├── database.py           # Updated: WAL mode pragma on engine creation
├── config.py             # No change (MASSIVE_API_KEY already loaded)
├── models/               # No change
├── routes/
│   ├── __init__.py       # No change
│   ├── health.py         # No change
│   ├── stream.py         # NEW: GET /api/stream/prices SSE endpoint
│   └── watchlist.py      # NEW: GET/POST/DELETE /api/watchlist (calls provider add/remove)
└── market/               # NEW directory
    ├── __init__.py       # Exports: MarketDataProvider, PriceUpdate, create_provider
    ├── types.py          # PriceUpdate dataclass
    ├── base.py           # MarketDataProvider ABC
    ├── factory.py        # create_provider()
    ├── simulator.py      # SimulatorProvider
    └── massive.py        # MassiveProvider
```

`backend/market/__init__.py`:

```python
from .types import PriceUpdate
from .base import MarketDataProvider
from .factory import create_provider

__all__ = ["PriceUpdate", "MarketDataProvider", "create_provider"]
```

---

## Behaviour Summary

| Scenario                       | Behaviour                                              |
|--------------------------------|--------------------------------------------------------|
| `MASSIVE_API_KEY` set          | MassiveProvider polls /v2/snapshot every 15s           |
| `MASSIVE_API_KEY` absent/empty | SimulatorProvider generates GBM prices every 500ms     |
| Ticker added to watchlist      | provider.add_ticker() included on next poll/tick        |
| Ticker removed from watchlist  | provider.remove_ticker() evicts from cache immediately  |
| Transient API error            | Stale cache retained; SSE pushes last known prices     |
| First Massive poll             | prev_close seeded from prevDay.c                       |
| First simulator tick           | prev_close = seed price; change = 0                    |
| Client SSE disconnect          | Generator breaks; EventSource reconnects automatically  |
| Concurrent DB writes           | WAL mode prevents database is locked on SQLite         |
| Unknown ticker added           | Simulator seeds at $100.0; change starts at 0          |
