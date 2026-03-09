# Market Data Interface

This document defines the unified Python interface for retrieving stock prices in Finance Ally. The backend selects the implementation at startup based on the `MASSIVE_API_KEY` environment variable.

---

## Design Goals

- Single interface, two implementations: `MassiveProvider` and `SimulatorProvider`
- All downstream code (SSE streaming, price cache, API routes) is agnostic to the source
- Both implementations run as background tasks that write to a shared in-memory price cache
- Adding/removing tickers from the watchlist updates the cache dynamically

---

## PriceUpdate Data Class

Both implementations emit `PriceUpdate` objects:

```python
# backend/market/types.py

from dataclasses import dataclass


@dataclass
class PriceUpdate:
    ticker: str
    price: float
    prev_price: float        # price from the previous emission for this ticker
    prev_close: float        # previous trading day's close (for daily % change)
    timestamp: float         # Unix timestamp (seconds)
    change: float            # price - prev_close
    change_pct: float        # (price - prev_close) / prev_close * 100
```

---

## Abstract Interface

```python
# backend/market/base.py

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
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
        """Add a ticker to the active set. Takes effect on next poll cycle."""
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

## Provider Factory

The application creates exactly one provider instance at startup:

```python
# backend/market/factory.py

import os
from .base import MarketDataProvider
from .massive import MassiveProvider
from .simulator import SimulatorProvider


def create_provider() -> MarketDataProvider:
    """Return MassiveProvider if MASSIVE_API_KEY is set, else SimulatorProvider."""
    api_key = os.getenv("MASSIVE_API_KEY", "").strip()
    if api_key:
        return MassiveProvider(api_key=api_key)
    return SimulatorProvider()
```

---

## MassiveProvider Implementation

```python
# backend/market/massive.py

import asyncio
import time
import httpx
from .base import MarketDataProvider
from .types import PriceUpdate

BASE_URL = "https://api.polygon.io"
POLL_INTERVAL = 15.0   # seconds — safe for free tier (5 req/min)


class MassiveProvider(MarketDataProvider):
    def __init__(self, api_key: str) -> None:
        self._api_key = api_key
        self._tickers: set[str] = set()
        self._cache: dict[str, PriceUpdate] = {}
        self._prev_closes: dict[str, float] = {}   # seeded on first poll
        self._task: asyncio.Task | None = None

    async def start(self, tickers: list[str]) -> None:
        self._tickers = set(tickers)
        self._task = asyncio.create_task(self._poll_loop())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            await asyncio.gather(self._task, return_exceptions=True)

    def add_ticker(self, ticker: str) -> None:
        self._tickers.add(ticker.upper())

    def remove_ticker(self, ticker: str) -> None:
        self._tickers.discard(ticker.upper())
        self._cache.pop(ticker.upper(), None)
        self._prev_closes.pop(ticker.upper(), None)

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
            return   # keep stale cache on transient errors

        for item in data.get("tickers", []):
            ticker = item["ticker"]
            price = (item.get("lastTrade") or {}).get("p") or item["day"]["c"]
            prev_close = item["prevDay"]["c"]

            # Seed prev_close on first sight
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
                change=change,
                change_pct=change_pct,
            )
```

---

## File Layout

```
backend/
└── market/
    ├── __init__.py
    ├── types.py          # PriceUpdate dataclass
    ├── base.py           # MarketDataProvider ABC
    ├── factory.py        # create_provider()
    ├── massive.py        # MassiveProvider
    └── simulator.py      # SimulatorProvider (see MARKET_SIMULATOR.md)
```

---

## Integration with FastAPI

```python
# backend/main.py (excerpt)

from contextlib import asynccontextmanager
from fastapi import FastAPI
from .market.factory import create_provider
from .db import get_watchlist_tickers

provider = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global provider
    provider = create_provider()
    tickers = await get_watchlist_tickers(user_id="default")
    await provider.start(tickers)
    yield
    await provider.stop()

app = FastAPI(lifespan=lifespan)
```

---

## SSE Streaming Integration

The SSE endpoint reads from the provider's cache at a fixed cadence (~500ms) and pushes updates to all connected clients:

```python
# backend/routes/stream.py (excerpt)

import asyncio
import json
from fastapi import Request
from fastapi.responses import StreamingResponse

async def price_stream(request: Request):
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
            await asyncio.sleep(0.5)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

---

## Watchlist API Integration

When the watchlist changes, update the provider directly:

```python
# Adding a ticker
await db_add_ticker(ticker)
provider.add_ticker(ticker)

# Removing a ticker
await db_remove_ticker(ticker)
provider.remove_ticker(ticker)
```

---

## Behavior Summary

| Scenario                        | Behavior                                                   |
|--------------------------------|------------------------------------------------------------|
| `MASSIVE_API_KEY` set           | MassiveProvider polls `/v2/snapshot` every 15 s            |
| `MASSIVE_API_KEY` absent/empty  | SimulatorProvider generates GBM prices every ~500 ms       |
| Ticker added to watchlist       | `provider.add_ticker()` — included on next poll/tick       |
| Ticker removed from watchlist   | `provider.remove_ticker()` — evicted from cache            |
| Transient API error             | Stale cache retained; SSE keeps pushing last known prices  |
| First poll                      | `prev_close` seeded from API `prevDay.c`                   |
