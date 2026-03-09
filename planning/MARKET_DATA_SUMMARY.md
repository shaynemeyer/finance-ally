# FA-4: Market Data Backend — Implementation Summary

## Overview

FA-4 delivered the complete market data backend: a pluggable provider system, live price simulation, optional real-data integration via Massive (Polygon.io), an SSE streaming endpoint, and watchlist REST routes — all covered by unit tests.

## What Was Built

### `backend/market/` Package

| File           | Purpose                                                                   |
| -------------- | ------------------------------------------------------------------------- |
| `types.py`     | `PriceUpdate` dataclass — the shared data shape across the entire system  |
| `base.py`      | `MarketDataProvider` ABC — contract both providers must implement         |
| `simulator.py` | `SimulatorProvider` — in-process GBM simulation                           |
| `massive.py`   | `MassiveProvider` — Polygon.io REST polling via `httpx`                   |
| `factory.py`   | `create_provider()` — picks the right provider based on `MASSIVE_API_KEY` |

### Routes

| File                  | Endpoints                                                                     |
| --------------------- | ----------------------------------------------------------------------------- |
| `routes/stream.py`    | `GET /api/stream/prices` — SSE stream                                         |
| `routes/watchlist.py` | `GET /api/watchlist`, `POST /api/watchlist`, `DELETE /api/watchlist/{ticker}` |

### Tests

| File                      | Coverage                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| `tests/test_simulator.py` | GBM tick math, price floor, add/remove ticker, start/stop lifecycle, correlated moves              |
| `tests/test_massive.py`   | REST response parsing, `lastTrade` fallback, prev_close seeding, HTTP error resilience, start/stop |
| `tests/test_stream.py`    | SSE format, disconnect handling, empty cache, response headers                                     |
| `tests/test_watchlist.py` | All CRUD operations, case normalization, 409/404 error cases                                       |

---

## Key Design Decisions

### Abstract Interface

`MarketDataProvider` defines five methods: `start`, `stop`, `add_ticker`, `remove_ticker`, `get_price`, `get_all_prices`. Both implementations satisfy this contract, so all downstream code (SSE, watchlist routes) is agnostic to data source.

### Simulator: Geometric Brownian Motion

- Tick interval: 500ms
- Per-ticker drift (`mu`) and volatility (`sigma`) tuned to real-world characteristics (e.g., TSLA σ=0.65, JPM σ=0.22)
- Correlated market factor: each tick draws a shared `z_market` noise term; each ticker blends it with an idiosyncratic component via its `rho` weight
- Random events: 0.2% probability per tick of a sudden 2–5% move in either direction
- Price floor: `max(price, 0.01)` prevents degenerate zero/negative prices
- `prev_close` is set at simulator start (seed price) and never updated — gives the frontend a stable daily-change baseline for the session

### Massive Provider: REST Polling

- Polls `GET /v2/snapshot/locale/us/markets/stocks/tickers` with all active tickers in one request
- Falls back from `lastTrade.p` to `day.c` when last trade price is absent (handles pre-market/illiquid tickers)
- HTTP errors are silently swallowed — the cache retains the last good data
- Poll interval driven by `MASSIVE_POLL_INTERVAL` in `config.py` (defaults suitable for free-tier rate limits)

### Factory / Environment Switch

```python
def create_provider() -> MarketDataProvider:
    if MASSIVE_API_KEY:
        return MassiveProvider(api_key=MASSIVE_API_KEY)
    return SimulatorProvider()
```

No other code knows which provider is active.

### SSE Streaming (`/api/stream/prices`)

- Every 500ms: reads the full price cache and emits one `data: {...}\n\n` event per ticker
- Checks `request.is_disconnected()` each iteration to clean up stale connections
- Response headers: `Cache-Control: no-cache`, `X-Accel-Buffering: no` (required for nginx proxies)
- Client reconnects automatically via `EventSource` built-in retry

### Watchlist Routes

- `POST /api/watchlist` — persists to SQLite, then calls `provider.add_ticker()` so the new ticker enters the price cache immediately
- `DELETE /api/watchlist/{ticker}` — removes from SQLite, then calls `provider.remove_ticker()` so the cache entry is purged and SSE stops emitting it
- Both routes normalize to uppercase; duplicate adds return 409, missing deletes return 404

---

## Test Infrastructure Notes

- `asyncio_mode = "auto"` in `pyproject.toml` — no `@pytest.mark.asyncio` decorators needed
- SSE tests call `price_stream(mock_request)` directly and consume `response.body_iterator` with a bounded `collect_chunks()` helper, then call `aclose()`. This avoids the deadlock that occurs when using `ASGITransport` with an infinite generator in a shared event loop.
- Massive tests use `respx` to mock `httpx` at the transport layer — no real network calls
- Watchlist tests use an in-memory SQLite engine (`StaticPool`) and a `FakeProvider` stub to verify that route handlers call `add_ticker`/`remove_ticker` correctly

---

## Dependencies Added

- `httpx` — async HTTP client for Massive REST polling
- `respx` (dev) — `httpx` mock transport for tests

---

## Files Changed in `backend/`

```text
backend/
├── market/
│   ├── __init__.py
│   ├── base.py
│   ├── factory.py
│   ├── massive.py
│   ├── simulator.py
│   └── types.py
├── routes/
│   ├── __init__.py       # kept empty (avoids circular import)
│   ├── stream.py
│   └── watchlist.py
├── tests/
│   ├── test_massive.py
│   ├── test_simulator.py
│   ├── test_stream.py
│   └── test_watchlist.py
├── config.py             # added MASSIVE_API_KEY, MASSIVE_POLL_INTERVAL
├── main.py               # provider created in lifespan, stored on app.state
└── pyproject.toml        # added httpx, respx
```
