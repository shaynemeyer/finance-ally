# Market Simulator

This document describes the approach and code structure for the built-in price simulator — the default market data source when `MASSIVE_API_KEY` is not set.

---

## Overview

The simulator uses **Geometric Brownian Motion (GBM)** to generate realistic-looking price series. It:

- Runs as an in-process asyncio background task (no external dependencies)
- Updates prices every ~500ms
- Starts from realistic seed prices per ticker
- Applies per-ticker drift and volatility parameters
- Applies a correlation factor so related tickers (e.g. tech stocks) move together
- Occasionally fires random "event" spikes for drama

---

## Geometric Brownian Motion

GBM models continuous price evolution as:

```
S(t+dt) = S(t) * exp((mu - sigma²/2) * dt + sigma * sqrt(dt) * Z)
```

Where:
- `S(t)` — current price
- `mu` — drift (annualized, e.g. 0.05 for 5% annual return tendency)
- `sigma` — volatility (annualized, e.g. 0.30 for 30% annual vol)
- `dt` — time step in years (0.5s ≈ 0.5 / (252 * 6.5 * 3600) years)
- `Z` — standard normal random variable

At 500ms intervals with annualized params, `dt ≈ 1.58e-7`. This keeps per-step moves small (typically ±0.1–0.3%) while allowing meaningful drift over minutes.

---

## Seed Prices and Per-Ticker Parameters

```python
# backend/market/simulator.py

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

# (mu, sigma) — annualized drift and volatility
TICKER_PARAMS: dict[str, tuple[float, float]] = {
    "AAPL":  (0.08, 0.28),
    "GOOGL": (0.07, 0.30),
    "MSFT":  (0.09, 0.26),
    "AMZN":  (0.10, 0.32),
    "TSLA":  (0.05, 0.65),   # high volatility
    "NVDA":  (0.15, 0.55),   # high growth, high vol
    "META":  (0.10, 0.38),
    "JPM":   (0.06, 0.22),   # lower vol, financials
    "V":     (0.07, 0.20),
    "NFLX":  (0.08, 0.40),
}

# Default params for tickers added at runtime
DEFAULT_PARAMS: tuple[float, float] = (0.07, 0.35)
```

---

## Correlation

A market-wide factor `Z_market` is drawn once per tick. Each ticker's price step mixes this with a ticker-specific random component:

```
Z_ticker = rho * Z_market + sqrt(1 - rho²) * Z_idiosyncratic
```

Where `rho` (correlation coefficient) is set per ticker group:

| Group          | Tickers                   | rho  |
|---------------|---------------------------|------|
| Tech/growth    | AAPL, GOOGL, MSFT, AMZN, META, NVDA, NFLX | 0.6 |
| High-beta      | TSLA                      | 0.4  |
| Financials     | JPM, V                    | 0.3  |
| Unknown        | any dynamically added      | 0.5  |

This means tech stocks tend to move together, while JPM and V are less correlated with the NASDAQ-heavy group.

---

## Random Events

Every tick, each ticker has a small probability of a sudden spike or drop:

```
EVENT_PROBABILITY = 0.002   # 0.2% chance per tick (≈ 1 event per ~8 minutes per ticker)
EVENT_MAGNITUDE   = 0.03    # ±2–5% move (uniform draw from [0.02, 0.05])
```

Events are applied as a multiplier on top of the GBM step:

```python
import random

def apply_event(price: float) -> float:
    if random.random() < EVENT_PROBABILITY:
        direction = 1 if random.random() > 0.5 else -1
        magnitude = random.uniform(0.02, 0.05)
        return price * (1 + direction * magnitude)
    return price
```

---

## Full SimulatorProvider Implementation

```python
# backend/market/simulator.py

import asyncio
import math
import random
import time
from .base import MarketDataProvider
from .types import PriceUpdate

TICK_INTERVAL = 0.5                    # seconds between price updates
SECONDS_PER_YEAR = 252 * 6.5 * 3600   # trading seconds per year
DT = TICK_INTERVAL / SECONDS_PER_YEAR # time step in years

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
    "AAPL":  0.6,
    "GOOGL": 0.6,
    "MSFT":  0.6,
    "AMZN":  0.6,
    "META":  0.6,
    "NVDA":  0.6,
    "NFLX":  0.6,
    "TSLA":  0.4,
    "JPM":   0.3,
    "V":     0.3,
}

DEFAULT_PARAMS = (0.07, 0.35)
DEFAULT_RHO = 0.5


class SimulatorProvider(MarketDataProvider):
    def __init__(self) -> None:
        self._prices: dict[str, float] = {}        # current simulated price
        self._prev_closes: dict[str, float] = {}   # price at "open" (sim start)
        self._cache: dict[str, PriceUpdate] = {}
        self._tickers: set[str] = set()
        self._task: asyncio.Task | None = None

    async def start(self, tickers: list[str]) -> None:
        for ticker in tickers:
            self._init_ticker(ticker)
        self._tickers = set(t.upper() for t in tickers)
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
            new_price = max(new_price, 0.01)   # price floor

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

---

## Dynamic Ticker Handling

When a user adds an unknown ticker (e.g. `PYPL`):

1. `add_ticker("PYPL")` is called on the running provider
2. `_init_ticker` seeds it from `SEED_PRICES` (falls back to `$100.0` for unknowns)
3. It joins the tick loop immediately on the next tick
4. `prev_close` is set to the seed price (so initial `change` is `0`)

This is intentional — the simulator makes no claim about real prices for unknown tickers.

---

## Design Notes

- **No wall clock drift correction.** `asyncio.sleep(0.5)` is not exactly 500ms, but this is fine for a simulator.
- **Prices are never reset between ticks.** The simulated price drifts from its seed price indefinitely. `prev_close` is set once at startup (`_init_ticker`) and does not roll over at midnight — it represents "price since the simulator started", which resets on container restart.
- **Thread safety.** The tick loop and the SSE reader both run on the asyncio event loop (single thread), so `dict` reads in `get_all_prices()` are safe without locks.
- **Price floor.** Prices are clamped to `$0.01` to prevent GBM from hitting zero.
- **No upper bound.** High-volatility tickers (TSLA, NVDA) can reach unrealistic prices over time. This is acceptable for a demo.
