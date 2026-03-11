# Finance Ally — Project Status

Last updated: 2026-03-11 (FA-9 complete)

---

## Completed

| Ticket | Description                                                                                    | PR  |
| ------ | ---------------------------------------------------------------------------------------------- | --- |
| FA-1   | Backend setup — FastAPI, SQLite, models, seed data, health route                               | #2  |
| FA-2   | Frontend setup — Next.js 16 static export, ShadCN, Tailwind v4, Zustand, Zod, Vitest           | #3  |
| FA-3   | Market data design (planning doc only)                                                         | #4  |
| FA-4   | Market data backend — GBM simulator, Massive (Polygon.io) client, SSE stream, watchlist routes | #5  |
| FA-5   | Portfolio API — positions, trades, P&L, cash balance, portfolio snapshots                      | #6  |
| FA-6   | LLM/chat integration — OpenRouter, structured outputs, auto-execute trades/watchlist           | #7  |
| FA-7   | Watchlist panel, SSE price streaming, sparklines, connection status                            | #8  |
| FA-8   | Portfolio heatmap (treemap), P&L chart (line), positions table, trade bar                      | #9  |
| FA-9   | AI chat sidebar — ChatPanel, chatStore, inline trade/watchlist confirmations, clear history    | #10 |

---

## Remaining

| What                       | Notes                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| ~~AI chat panel (frontend)~~ | Done in FA-9                                                                                   |
| Main chart area (frontend) | Larger price chart for selected ticker; click watchlist row to select                            |
| Docker / deployment        | Multi-stage Dockerfile (Node → Python), start/stop scripts (Podman + Docker), docker-compose.yml |
| E2E tests                  | Playwright in `test/`, docker-compose.test.yml, LLM_MOCK=true for deterministic runs             |

---

## Current Backend Structure

```text
backend/
├── main.py                 # FastAPI app, lifespan, static file mount
├── config.py               # dotenv, DATABASE_URL, OPENROUTER_API_KEY, MASSIVE_API_KEY, LLM_MOCK
├── database.py             # SQLite engine (WAL mode), init_db(), get_session()
├── tasks.py                # Background task: portfolio snapshot every 10s
├── models/
│   ├── user_profile.py     # cash_balance
│   ├── watchlist.py        # user's watched tickers
│   ├── position.py         # current holdings (qty, avg_cost)
│   ├── trade.py            # append-only trade log
│   ├── portfolio_snapshot.py  # total_value over time (for P&L chart)
│   ├── chat_message.py     # LLM conversation history + executed actions
│   └── seed.py             # default user + 10 tickers
├── market/
│   ├── types.py            # PriceUpdate dataclass
│   ├── base.py             # MarketDataProvider ABC
│   ├── simulator.py        # GBM simulator (500ms ticks, correlation, random events)
│   ├── massive.py          # Polygon.io REST polling via httpx
│   └── factory.py          # picks provider based on MASSIVE_API_KEY
├── routes/
│   ├── health.py           # GET /api/health
│   ├── stream.py           # GET /api/stream/prices (SSE)
│   ├── watchlist.py        # GET/POST/DELETE /api/watchlist
│   ├── portfolio.py        # GET /api/portfolio, POST /api/portfolio/trade, GET /api/portfolio/history
│   └── chat.py             # GET /api/chat, POST /api/chat, DELETE /api/chat
├── services/
│   ├── context.py          # Builds portfolio context string for LLM system prompt
│   ├── llm.py              # OpenRouter call (gpt-4o-mini) with structured output schema
│   └── executor.py         # Auto-executes trades and watchlist changes from LLM response
└── tests/
    ├── test_simulator.py
    ├── test_massive.py
    ├── test_stream.py
    ├── test_watchlist.py
    ├── test_portfolio.py
    └── test_chat.py
```

---

## Current Frontend Structure

```text
frontend/src/
├── app/
│   ├── layout.tsx          # <html className="dark">, global font
│   ├── page.tsx            # Main SPA layout: watchlist + chart + portfolio + trade bar + chat
│   └── globals.css         # Tailwind v4, dark theme variables, flash-up/flash-down CSS
├── types/
│   ├── market.ts           # PriceEventSchema, WatchlistItemSchema (Zod)
│   ├── portfolio.ts        # PositionSchema, PortfolioSchema, SnapshotSchema (Zod)
│   └── chat.ts             # ChatMessageSchema, TradeActionSchema, WatchlistActionSchema (Zod)
├── store/
│   ├── priceStore.ts       # prices map, history (100 pts/ticker), connectionStatus
│   ├── watchlistStore.ts   # tickers array, selectedTicker
│   ├── portfolioStore.ts   # portfolio state, history; fetchPortfolio, fetchHistory
│   └── chatStore.ts        # messages, isLoading; fetchHistory, sendMessage, clearHistory
├── hooks/
│   └── usePriceStream.ts   # EventSource SSE, cancelled-flag cleanup on unmount
└── components/
    ├── header/
    │   └── ConnectionStatus.tsx    # colored dot (green/yellow/red)
    ├── watchlist/
    │   ├── Sparkline.tsx           # SVG polyline (no charting lib)
    │   ├── WatchlistRow.tsx        # price flash via DOM ref + offsetHeight reflow
    │   └── WatchlistPanel.tsx      # fetch /api/watchlist, add/remove UI
    ├── portfolio/
    │   ├── PLChart.tsx             # Recharts LineChart, portfolio value over time
    │   ├── PortfolioHeatmap.tsx    # Recharts Treemap, sized by weight, colored by P&L
    │   └── PositionsTable.tsx      # tabular positions with unrealized P&L
    ├── trading/
    │   └── TradeBar.tsx            # ticker + qty, buy/sell, last trade confirmation
    ├── chat/
    │   └── ChatPanel.tsx           # collapsible sidebar; history, input, action badges, clear
    └── ui/                         # ShadCN: button, input
```

---

## Test Coverage

**Backend** — 83 tests passing across 6 files
**Frontend** — 95 tests passing across 15 files

Frontend test files:

- `store/__tests__/priceStore.test.ts` — 7 tests
- `store/__tests__/watchlistStore.test.ts` — 7 tests
- `store/__tests__/portfolioStore.test.ts` — 8 tests (includes network rejection)
- `store/__tests__/chatStore.test.ts` — 8 tests (fetch history, send message, error paths)
- `hooks/__tests__/usePriceStream.test.ts` — 6 tests
- `components/header/__tests__/ConnectionStatus.test.tsx` — 5 tests
- `components/watchlist/__tests__/Sparkline.test.tsx` — 7 tests
- `components/trading/__tests__/TradeBar.test.tsx` — 5 tests
- `components/portfolio/__tests__/PLChart.test.ts` — 7 tests (pure functions)
- `components/portfolio/__tests__/PLChart.render.test.tsx` — 3 tests (component render)
- `components/portfolio/__tests__/PortfolioHeatmap.test.ts` — 7 tests (pure functions)
- `components/portfolio/__tests__/PortfolioHeatmap.render.test.tsx` — 3 tests (component render)
- `components/portfolio/__tests__/PositionsTable.test.ts` — 2 tests (pure functions)
- `components/portfolio/__tests__/PositionsTable.render.test.tsx` — 6 tests (component render)
- `components/chat/__tests__/ChatPanel.render.test.tsx` — 14 tests (render, collapse, actions, loading)

---

## Key Technical Decisions

- **SSE over WebSockets** — one-way push, simpler, universal browser support
- **Static Next.js export** — single origin, no CORS, one port/container
- **SQLite + WAL mode** — zero config, self-contained, volume-mounted
- **Podman + Docker** — scripts detect `podman` first, fall back to `docker`
- **Zustand for state** — stores hold actions; actions are stable references (safe in dep arrays)
- **`'use client'`** — on component files only, not hook files
- **Price flash** — DOM ref + `void el.offsetHeight` reflow restarts CSS animation on same-direction ticks
- **`asyncio_mode = "auto"`** — no `@pytest.mark.asyncio` decorator needed in backend tests
- **SSE test pattern** — consume `body_iterator` directly; avoid `ASGITransport` (deadlocks with infinite generators)
- **Chat optimistic UI** — user message added immediately with client UUID; on success `fetchHistory()` replaces store with server-canonical list (avoids duplicate IDs)
- **LLM model** — `openai/gpt-4o-mini` via OpenRouter; `openai/gpt-oss-120b` was replaced because it leaked chain-of-thought into the `message` field
- **Chat clear** — `DELETE /api/chat` uses `select` + `session.delete(row)` per instance (SQLModel does not export bulk `delete()`)
