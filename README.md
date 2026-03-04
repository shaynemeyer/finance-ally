# Finance Ally

An AI-powered trading workstation with live market data, a simulated portfolio, and an LLM chat assistant that can analyze positions and execute trades.

## Quick Start

```bash
cp .env.example .env
# Add your OPENROUTER_API_KEY to .env
./scripts/start_mac.sh
```

Then open http://localhost:8000.

## Features

- Live-streaming prices with flash animations (green/red on uptick/downtick)
- Sparkline mini-charts per ticker, accumulated from the SSE stream
- $10,000 virtual cash to trade with — market orders, instant fill
- Portfolio heatmap (treemap) sized by weight, colored by P&L
- P&L chart tracking total portfolio value over time
- Positions table with unrealized P&L per ticker
- AI chat assistant — ask questions, get analysis, execute trades via natural language

## Architecture

Single Docker container on port 8000:

- **Frontend**: Next.js static export (TypeScript, ShadCN, Zustand, Tailwind)
- **Backend**: FastAPI (Python/uv) serving both the API and static files
- **Database**: SQLite at `db/finance-ally.db` (volume-mounted)
- **Real-time**: Server-Sent Events (`/api/stream/prices`)
- **AI**: OpenRouter (`openai/gpt-oss-120b`) with structured outputs

## Environment Variables

| Variable            | Required | Description                                      |
| ------------------- | -------- | ------------------------------------------------ |
| `OPENROUTER_API_KEY`| Yes      | OpenRouter API key for LLM chat                  |
| `MASSIVE_API_KEY`   | No       | Polygon.io key for real market data (simulator used if absent) |
| `LLM_MOCK`          | No       | Set to `true` for deterministic mock LLM responses (testing) |

## Scripts

| Script                      | Description                        |
| --------------------------- | ---------------------------------- |
| `scripts/start_mac.sh`      | Build and run the Docker container  |
| `scripts/stop_mac.sh`       | Stop and remove the container       |
| `scripts/start_windows.ps1` | Windows PowerShell equivalent       |
| `scripts/stop_windows.ps1`  | Windows PowerShell equivalent       |

## Development

```bash
# Backend
cd backend && uv run uvicorn main:app --reload

# Frontend
cd frontend && npm install && npm run dev
```

## Testing

E2E tests use Playwright via a separate Docker Compose setup:

```bash
cd test && docker compose -f docker-compose.test.yml up
```

Unit tests: `pytest` (backend), React Testing Library (frontend).
