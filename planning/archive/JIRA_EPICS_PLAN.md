# Context

Finance Ally has 4 completed tickets (FA-1 backend setup, FA-2 frontend boilerplate, FA-3 market data design, FA-4 market data backend). The remaining work — portfolio APIs, LLM chat, frontend UI, Docker, and E2E tests — needs to be broken into Jira issues.

## Proposed Jira Items

### Epic 1: Portfolio & Trading Backend (FA-5)

**Summary**: Build portfolio API — positions, trades, P&L, cash balance

Sub-tasks or stories:

- `GET /api/portfolio` endpoint (cash, positions, total value, unrealized P&L)
- `POST /api/portfolio/trade` endpoint (buy/sell market orders, validation)
- `GET /api/portfolio/history` endpoint (24-hour portfolio value snapshots)
- Background task: snapshot portfolio value every 10 seconds
- Unit tests: trade logic, P&L math, edge cases (insufficient cash, oversell)

---

### Epic 2: LLM Chat Integration (FA-6)

**Summary**: Integrate OpenRouter LLM with structured outputs for AI trading assistant

Sub-tasks or stories:

- `GET /api/chat` endpoint (retrieve conversation history)
- `POST /api/chat` endpoint (send message, get response, auto-execute actions)
- OpenRouter client using `openai/gpt-oss-120b` with structured JSON output
- Portfolio context loader for LLM system prompt
- Trade auto-execution from LLM response (with validation)
- Watchlist change auto-execution from LLM response
- LLM mock mode (`LLM_MOCK=true`) for deterministic test responses
- Unit tests: structured output parsing, mock mode, trade validation in chat flow

---

### Epic 3: Frontend UI — Market Data & Watchlist (FA-7)

**Summary**: Build watchlist panel, price streaming, and sparklines

Sub-tasks or stories:

- SSE connection via EventSource to `/api/stream/prices` (Zustand store + hook)
- Watchlist panel component (`components/watchlist/WatchlistPanel.tsx`)
- Price flash animation (green/red CSS transition on price change, 500ms fade)
- Sparkline mini-charts (accumulated from SSE ticks since page load)
- Connection status indicator in header (green/yellow/red dot)
- Add/remove ticker UI (manual watchlist management)
- Zustand store for watchlist and live prices

---

### Epic 4: Frontend UI — Portfolio & Trading (FA-8)

**Summary**: Build portfolio heatmap, P&L chart, positions table, and trade bar

Sub-tasks or stories:

- Positions table component (`components/portfolio/PositionsTable.tsx`)
- Portfolio heatmap/treemap component (`components/portfolio/PortfolioHeatmap.tsx`)
- P&L chart component (`components/portfolio/PLChart.tsx`) using Lightweight Charts or Recharts
- Trade bar component (`components/trading/TradeBar.tsx`) — ticker, quantity, buy/sell
- Header component with live total value and cash balance
- Zustand store for portfolio state
- API client functions for portfolio and trade endpoints

---

### Epic 5: Frontend UI — AI Chat Panel (FA-9)

**Summary**: Build collapsible AI chat sidebar with inline trade confirmations

Sub-tasks or stories:

- Chat panel component (`components/chat/ChatPanel.tsx`) — docked/collapsible
- Message input and scrolling conversation history
- Loading indicator while waiting for LLM response
- Inline trade execution and watchlist change confirmations in chat
- Zustand store for chat messages
- API client for chat endpoints

---

### Epic 6: Main Chart View (FA-10)

**Summary**: Build main ticker chart area for selected ticker

Sub-tasks or stories:

- Main chart component (`components/chart/MainChart.tsx`)
- Click-to-select ticker from watchlist
- Price-over-time chart (canvas-based: Lightweight Charts preferred)
- Zustand store for selected ticker

---

### Epic 7: Docker & Deployment (FA-11)

**Summary**: Multi-stage Dockerfile and start/stop scripts

Sub-tasks or stories:

- Multi-stage Dockerfile (Node 22 build → Python 3.12 runtime)
- FastAPI serves Next.js static export from `static/` directory
- `docker-compose.yml` convenience wrapper
- `scripts/start_mac.sh` and `scripts/stop_mac.sh`
- `scripts/start_windows.ps1` and `scripts/stop_windows.ps1`
- Verify `.env` passthrough and SQLite volume mount

---

### Epic 8: E2E Testing (FA-12)

**Summary**: Playwright E2E test suite with Docker-based test infrastructure

Sub-tasks or stories:

- `test/docker-compose.test.yml` (app container + Playwright container)
- Scenario: fresh start — default watchlist, $10k balance, streaming prices
- Scenario: add and remove a ticker from watchlist
- Scenario: buy shares — cash decreases, position appears, portfolio updates
- Scenario: sell shares — cash increases, position updates or disappears
- Scenario: portfolio visualization — heatmap renders, P&L chart has data
- Scenario: AI chat (mock LLM) — send message, receive response, trade inline
- Scenario: SSE resilience — disconnect and verify reconnection

---

## Suggested Ticket Order

1. FA-5 (Portfolio Backend) — unblocks everything
2. FA-6 (LLM Chat Backend) — depends on FA-5
3. FA-7 (Frontend Market Data) — can start in parallel with FA-5
4. FA-8 (Frontend Portfolio & Trading) — depends on FA-5
5. FA-9 (Frontend Chat) — depends on FA-6
6. FA-10 (Main Chart) — can be done alongside FA-7 or FA-8
7. FA-11 (Docker) — can start after FA-5 APIs stabilize
8. FA-12 (E2E Tests) — final, after FA-11

## Critical Files to Note

- `backend/routes/` — add `portfolio.py` and `chat.py`
- `backend/services/` — create for trade execution and LLM logic
- `frontend/src/store/` — Zustand stores per domain
- `frontend/src/components/` — one component per file, `{domain}/{Component}.tsx`
- `Dockerfile` — root level, multi-stage
- `scripts/` — start/stop scripts
- `test/` — Playwright E2E tests
