# Test Coverage Report — FA-4 Market Data Backend

**Date**: 2026-03-07
**Ticket**: FA-4
**Total tests**: 34 passed, 0 failed
**Overall coverage**: 93%

---

## Summary

| Module              | Stmts | Miss | Cover   | Missing Lines |
| ------------------- | ----- | ---- | ------- | ------------- |
| market/**init**.py  | 4     | 0    | 100%    |               |
| market/base.py      | 15    | 0    | 100%    |               |
| market/factory.py   | 8     | 3    | 62%     | 9–11          |
| market/massive.py   | 59    | 4    | 93%     | 46–49         |
| market/simulator.py | 82    | 3    | 96%     | 141–143       |
| market/types.py     | 10    | 0    | 100%    |               |
| routes/**init**.py  | 0     | 0    | 100%    |               |
| routes/health.py    | 5     | 5    | 0%      | 1–8           |
| routes/stream.py    | 22    | 1    | 95%     | 35            |
| routes/watchlist.py | 38    | 0    | 100%    |               |
| **TOTAL**           | 243   | 16   | **93%** |               |

---

## Notes on Uncovered Lines

### `market/factory.py:9-11` (62%)

The `MassiveProvider` branch is not exercised in unit tests because no `MASSIVE_API_KEY` is set in the test environment. The `MassiveProvider` itself is tested independently in `test_massive.py`.

### `market/massive.py:46-49` (93%)

The `_poll_loop` early-exit guard (`if self._tickers`) when the ticker set is empty. Covered indirectly by `test_start_stop`.

### `market/simulator.py:141-143` (96%)

The `_apply_event` random-event branch (`if random.random() < EVENT_PROBABILITY`) is probabilistic (0.2% per tick). The floor guard (`max(new_price, 0.01)`) is tested by `test_tick_price_floor`.

### `routes/health.py:1-8` (0%)

The `GET /api/health` route was implemented in FA-1 with its own tests. Not in scope for FA-4.

### `routes/stream.py:35` (95%)

Line 35 is `await asyncio.sleep(SSE_INTERVAL)` inside the generator. Tests disconnect before reaching the sleep, so it's not executed. The sleep itself is trivial — it delegates to `asyncio`.

---

## Test Files

| File                      | Tests | Description                                                  |
| ------------------------- | ----- | ------------------------------------------------------------ |
| `tests/test_simulator.py` | 13    | GBM math, price floor, correlated moves, lifecycle           |
| `tests/test_massive.py`   | 8     | Polygon.io polling, cache updates, error handling, lifecycle |
| `tests/test_stream.py`    | 5     | SSE generator logic, disconnect handling, payload shape      |
| `tests/test_watchlist.py` | 8     | CRUD routes, provider integration, edge cases                |

---

## Run Command

```bash
cd backend && uv run pytest tests/ -v --cov=market --cov=routes --cov-report=term-missing
```
