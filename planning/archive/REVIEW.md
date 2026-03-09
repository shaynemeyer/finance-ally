# Finance Ally — Codebase Review

**Reviewer**: Claude Sonnet 4.6
**Date**: 2026-03-04
**Plan source**: `/Users/shaynemeyer/github/finance-ally/planning/PLAN.md`

---

## Executive Summary

The project exists only as a plan and scaffolding. No implementation has been written yet. The repository contains:

- `planning/PLAN.md` — the project specification
- `.env.example` — environment variable template
- `.gitignore` — Python-focused, with Node/frontend entries missing
- `README.md` — mirrors the plan accurately
- `CLAUDE.md` — project-level agent instructions
- `.claude/agents/reviewer.md` — this reviewer agent definition

The `backend/`, `frontend/`, `test/`, `scripts/`, and `db/` directories exist in the plan but are **absent from the repository** (no files, no `pyproject.toml`, no `package.json`, no `Dockerfile`, no `docker-compose.yml`). Everything below is therefore a review of the plan itself, not of running code.

---

## Critical Issues

### C1 — No implementation exists

**Area**: All
**Impact**: The application cannot run at all.

All deliverable directories and files described in Section 4 of the plan are absent:

- `backend/` — no FastAPI project, no `pyproject.toml`, no `uv.lock`, no source files
- `frontend/` — no Next.js project, no `package.json`, no components
- `Dockerfile` — absent
- `docker-compose.yml` — absent
- `scripts/` — absent (four scripts described, none present)
- `db/.gitkeep` — absent
- `test/` — absent

The `README.md` references `./scripts/start_mac.sh` as the entry point, which does not exist. A user following the README would immediately fail.

### C2 — `.env.example` is incomplete

**Area**: Configuration
**Impact**: A developer cloning the repo gets an incomplete template.

The current `.env.example` contains only:

```env
OPENROUTER_API_KEY=<your_openrouter_api_key_here>
```

The plan (Section 5) specifies three variables:

```env
OPENROUTER_API_KEY=your-openrouter-api-key-here
MASSIVE_API_KEY=
LLM_MOCK=false
```

`MASSIVE_API_KEY` and `LLM_MOCK` are missing from the committed template. This matters because `LLM_MOCK` is the switch for the entire test infrastructure. A developer standing up the test environment without knowing to add `LLM_MOCK=true` will trigger live LLM calls during E2E tests, which the plan explicitly says should not happen.

### C3 — `.gitignore` does not cover the frontend or Docker artifacts

**Status**: RESOLVED

`.gitignore` now includes `*.db`, `db/finance-ally.db`, `.next/`, `frontend/.next/`, `frontend/out/`, `frontend/node_modules/`, `frontend/.env.local`, and `.env.local`.

---

## Medium Issues

### M1 — Model name `openai/gpt-oss-120b` should be verified

**Area**: LLM Integration (Section 9)
**Impact**: The chat feature will fail at runtime if this model ID is not valid on OpenRouter.

As of the knowledge cutoff (August 2025), `openai/gpt-oss-120b` is not a recognizable published OpenRouter model slug. OpenRouter model slugs follow the pattern `provider/model-name` (e.g., `openai/gpt-4o`, `openai/o3`). Before implementation begins, the exact current model ID should be confirmed against the OpenRouter model list at `https://openrouter.ai/models`. Using an invalid model ID will cause all chat requests to fail with a 404 or 400 from OpenRouter at runtime, with no fallback.

### M2 — SSE reconnection gap not addressed for portfolio state

**Area**: Architecture (Section 6)
**Impact**: Users may see a stale watchlist after a reconnect.

The plan correctly notes that `EventSource` handles reconnection automatically (Section 6, SSE Streaming). However, there is no plan for how the frontend reconciles state during a gap. The SSE stream pushes current prices, but if a ticker was added to the watchlist while the client was disconnected, the frontend's in-memory sparkline data and watchlist state will be stale until the next full page load or an explicit REST fetch. The plan does not specify whether the frontend should re-fetch `GET /api/watchlist` on SSE reconnect. This gap should be documented as a known behaviour or addressed with a reconnect handler.

### M3 — Portfolio snapshot background task not specified in terms of concurrency

**Area**: Backend (Section 7)
**Impact**: Race conditions between the snapshot task, the SSE stream task, and trade execution.

The plan mentions two background tasks: the market data task (simulator or Massive poller) and the portfolio snapshot task (every 10 seconds). Both write to SQLite. FastAPI runs background tasks in the same process. SQLite in WAL mode handles concurrent readers well but serialises writers. The plan does not specify:

- Whether `WAL` mode is enabled (it should be, and the implementation should set `PRAGMA journal_mode=WAL` on connection)
- How the snapshot task gets current prices (from the in-memory price cache, presumably) — this should be explicit in the plan or implementation contract

Without WAL mode, concurrent writes from the snapshot task and a trade POST will cause `database is locked` errors under load.

### M4 — No input validation plan for the trade endpoint

**Area**: Backend API (Section 8)
**Impact**: Negative quantities and other malformed inputs could corrupt the portfolio.

The plan specifies `POST /api/portfolio/trade` accepts `{ticker, quantity, side}` but does not specify validation rules beyond "sufficient cash for buys, sufficient shares for sells". Omitted constraints:

- `quantity` must be positive (not zero, not negative)
- `quantity` should have a maximum precision (fractional shares supported, but `quantity=0.000001` is probably not meaningful)
- `ticker` should be validated against the watchlist or at minimum as a non-empty uppercase string
- `side` must be exactly `"buy"` or `"sell"` (an enum, not a free string)

These should be enforced by Pydantic/SQLModel at the schema level so they are caught before any business logic runs.

### M5 — Daily change % calculation basis is ambiguous

**Area**: Frontend (Section 10)
**Impact**: The watchlist display may show misleading or inconsistent figures.

The plan states daily change % is "calculated relative to the simulator's seed price; resets on container restart". This is a simulator-specific behaviour. When `MASSIVE_API_KEY` is set and the Massive API is used, there is no seed price — the first poll returns the current real-world price. The plan does not define how daily change % is calculated in the Massive API case. Two options exist (opening price from the API response, or the first price received since startup), and the plan should pick one and document it.

### M6 — `chat_messages.actions` column is untyped JSON stored as TEXT

**Area**: Database (Section 7)
**Impact**: Schema drift risk; difficult to query or validate.

The `actions` column in `chat_messages` stores JSON as TEXT. This is a common SQLite pattern but it means no schema enforcement at the database layer. If the LLM returns structured output with different field names than expected (e.g., `trade` instead of `trades`), the stored JSON will silently diverge from the schema. The plan should specify that the backend validates the structured output against the Pydantic schema before persisting, and that the stored JSON always conforms to the documented structure.

---

## Minor Improvements

### m1 — `README.md` development section assumes global tool availability

**Area**: Documentation
**Impact**: Friction for new developers.

The README development section says:

```bash
cd backend && uv run uvicorn main:app --reload
```

This assumes `uv` is installed globally. The README should note the installation step (`curl -Ls https://astral.sh/uv/install.sh | sh` or `brew install uv`) for developers who do not already have it. Similarly, the frontend section assumes `npm` is available without mentioning the required Node version (the plan specifies Node 22 in the Dockerfile).

### m2 — No `db/.gitkeep` in the repository

**Status**: RESOLVED

`db/.gitkeep` is committed. `backend/.gitkeep`, `frontend/.gitkeep`, `scripts/.gitkeep`, and `test/.gitkeep` are also present — all placeholder directories are scaffolded.

### m3 — `scripts/` directory is entirely absent

**Area**: Repository structure
**Impact**: The documented start/stop workflow does not work.

All four scripts (`start_mac.sh`, `stop_mac.sh`, `start_windows.ps1`, `stop_windows.ps1`) are described in the plan but not present. This is a gap rather than a plan defect, but it means the "single command to start" experience described in the vision is currently broken.

### m4 — No `Dockerfile` present

**Area**: Docker (Section 11)
**Impact**: The container cannot be built.

The multi-stage Dockerfile is fully specified in the plan but not written. The plan is clear about the build stages and intent. This is an implementation gap.

### m5 — `uv.lock` gitignore comment may cause lock file to be excluded

**Area**: Backend configuration
**Impact**: Reproducible builds may fail if the lock file is not committed.

The `.gitignore` contains a commented-out `#uv.lock` entry. The comment says it is "generally recommended to include uv.lock in version control". When `backend/pyproject.toml` and `uv.lock` are created, developers need to ensure `uv.lock` is not accidentally uncommented or excluded. The plan correctly calls out `uv` as the package manager. The `.gitignore` should have an explicit `!uv.lock` negation to make the intent unambiguous, or the comment should be removed.

### m6 — No `docker-compose.yml` present

**Area**: Docker (Section 11)
**Impact**: The optional convenience wrapper described in the plan is absent.

The plan lists `docker-compose.yml` as an "optional convenience wrapper". It is referenced in the directory structure but not implemented. This is low priority but should be tracked.

### m7 — Test infrastructure fully absent

**Area**: Testing (Section 12)
**Impact**: No tests can run.

`test/docker-compose.test.yml` and all Playwright tests are absent. Backend unit test structure (`pytest`) and frontend unit test structure (React Testing Library) are also absent. This means there is no test coverage safety net for implementation work.

### m8 — No plan for handling LLM structured output failures

**Area**: LLM Integration (Section 9)
**Impact**: A malformed LLM response will bubble up as an unhandled exception.

The plan says "graceful handling of malformed responses" is a backend unit test concern (Section 12) but does not specify the error handling contract in Section 9. Specifically: if the LLM returns JSON that does not match the structured output schema, what does the API return to the frontend? The frontend needs to know whether to display an error message or silently retry. This contract should be documented.

---

## Plan-Level Observations

These are not bugs but gaps or tensions in the plan that implementers should be aware of.

**Fractional shares and the Massive API**: The plan supports fractional share quantities (`quantity REAL`). Real brokerage APIs rarely allow fractional shares on all tickers. Since the Massive API is read-only (prices only) and trades are simulated, this is fine — but the plan should note explicitly that the Massive API is used only for price data, never for trade execution.

**SSE stream pushes all tickers, not just the user's watchlist**: Section 6 says "Server pushes price updates for all tickers known to the system". In a single-user model this equals the watchlist. However, if a ticker is removed from the watchlist, the plan says it "is also removed from the price cache and stops being pushed via SSE". The implementation must ensure the price cache is cleaned up synchronously with the watchlist deletion, not lazily, otherwise the SSE stream will continue pushing prices for a removed ticker until the next cache refresh cycle.

**No rate limiting on the trade endpoint**: The plan intentionally keeps the design simple. However, a user (or a misbehaving frontend) could POST thousands of trades per second. Since this is SQLite and single-user, this is unlikely to cause data corruption but could degrade SSE performance. Worth noting for implementers.

**`openai/gpt-oss-120b` structured output compatibility**: OpenRouter's structured output support depends on the underlying model. Not all models on OpenRouter support the `response_format: {type: "json_schema"}` parameter that is required for reliable structured outputs. The implementation should verify this model supports structured outputs before relying on it, and fall back to prompt-only JSON instruction if not.

---

## Summary Table

| ID  | Area            | Severity | Description                                               |
| --- | --------------- | -------- | --------------------------------------------------------- |
| C1  | All             | Critical | No implementation exists — project is plan-only           |
| C2  | Configuration   | Critical | `.env.example` missing `MASSIVE_API_KEY` and `LLM_MOCK`   |
| C3  | Repository      | ~~Critical~~ | ~~`.gitignore` does not cover `db/finance-ally.db`~~ — **RESOLVED** |
| M1  | LLM Integration | Medium   | Model ID `openai/gpt-oss-120b` unverified on OpenRouter   |
| M2  | Architecture    | Medium   | SSE reconnect does not re-sync watchlist state            |
| M3  | Backend         | Medium   | SQLite WAL mode and snapshot task concurrency unspecified |
| M4  | Backend API     | Medium   | Trade endpoint input validation not fully specified       |
| M5  | Frontend        | Medium   | Daily change % basis undefined for Massive API mode       |
| M6  | Database        | Medium   | `actions` JSON column has no schema enforcement           |
| m1  | Documentation   | Minor    | README missing `uv` and Node 22 install prerequisites     |
| m2  | Repository      | ~~Minor~~ | ~~`db/.gitkeep` absent from repository~~ — **RESOLVED**  |
| m3  | Repository      | Minor    | `scripts/` directory entirely absent                      |
| m4  | Docker          | Minor    | `Dockerfile` absent                                       |
| m5  | Configuration   | Minor    | `uv.lock` gitignore comment ambiguous                     |
| m6  | Docker          | Minor    | `docker-compose.yml` absent                               |
| m7  | Testing         | Minor    | All test infrastructure absent                            |
| m8  | LLM Integration | Minor    | No documented error contract for malformed LLM responses  |

---

## Recommended First Steps for Implementation

1. Fix `.env.example` to include all three variables (resolves C2).
2. Add `db/finance-ally.db` to `.gitignore` and create `db/.gitkeep` (resolves C3, m2).
3. Add frontend-specific entries to `.gitignore` (`.next/`, `frontend/out/`).
4. Verify the OpenRouter model ID before writing any LLM code (resolves M1).
5. Implement backend first: `pyproject.toml`, database schema, API routes, market simulator, SSE. Validate each layer before moving to the next.
6. Implement frontend second, consuming the running backend.
7. Write the Dockerfile once both layers are verified individually.
8. Add scripts and test infrastructure last.
