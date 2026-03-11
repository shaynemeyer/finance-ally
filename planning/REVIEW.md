# Finance Ally — Code Review (post FA-8, all issues resolved)

Reviewed by: Claude Sonnet 4.6
Date: 2026-03-10

---

## Status: All issues fixed

All bugs, logic errors, test gaps, and code quality issues identified in the comprehensive post-FA-8 review have been addressed. Backend: 83 tests passing. Frontend: 73 tests passing.

---

## Issues Fixed

### Priority 1 — Bugs

| File | Issue | Fix applied |
|------|-------|-------------|
| `portfolioStore.ts` | `fetch()` outside `try` — network rejection crashed calling `useEffect` | Moved `fetch` inside `try` |
| `portfolioStore.ts` | `catch {}` never reset state on Zod parse failure | Added `set({ portfolio: null })` / `set({ history: [] })` in catch |
| `routes/chat.py` | Unhandled `ValueError` from `call_llm` produced 500 and orphaned user message | `try/except ValueError` → `HTTPException(502)` |
| `services/llm.py` | `httpx.HTTPStatusError` from `raise_for_status()` propagated unhandled | Caught and re-raised as `ValueError` |
| `routes/portfolio.py` + `executor.py` | Float threshold `1e-9` left ghost position rows after fractional sells | Raised to `1e-6` in both files |

### Priority 2 — Logic Errors

| File | Issue | Fix applied |
|------|-------|-------------|
| `PLChart.tsx` | Hard-coded `timeZone: "UTC"` showed wrong hours for non-UTC users | Removed `timeZone` — browser now uses local time |
| `PortfolioHeatmap.tsx` | `content={... as any}` suppressed type checking | Replaced with render function `(props: CellProps) => <HeatmapCell {...props} />` |
| `routes/portfolio.py` | `avg_cost == 0` caused `ZeroDivisionError` → 500 | Guarded with `if pos.avg_cost != 0 else 0.0` |
| `routes/chat.py` | Non-deterministic UUID secondary sort for same-second messages | Removed `.id.desc()` secondary sort |
| `PositionsTable.tsx` | Negative P&L rendered as `$-123.45` instead of `-$123.45` | Fixed: `{isProfit ? "+$" : "-$"}${Math.abs(...)}` |

### Priority 3 — Test Coverage

| File | Issue | Fix applied |
|------|-------|-------------|
| `portfolioStore.test.ts` | No test for network rejection | Added tests for `fetch` throwing in both `fetchPortfolio` and `fetchHistory` |
| `test_portfolio.py` | No test for `avg_cost=0` guard | Added `test_get_portfolio_position_with_zero_avg_cost` |
| `test_chat.py` | No test for LLM error → 502 path | Added `test_post_chat_llm_error_returns_502` |
| Portfolio components | No component render tests | Added `PLChart.render.test.tsx`, `PortfolioHeatmap.render.test.tsx`, `PositionsTable.render.test.tsx` |

### Priority 4 — Code Quality

| File | Issue | Fix applied |
|------|-------|-------------|
| `routes/chat.py` | No-op `session.commit()` was non-obvious | Added clarifying comment |
| `services/llm.py` | Blocking 30s `httpx.post` undocumented | Added comment noting sync call and single-user caveat |

---

## Notes

- Recharts `ResponsiveContainer` render tests require `global.ResizeObserver = class { ... }` (must be a class, not an arrow function) — jsdom does not implement `ResizeObserver`
- Recharts renders no SVG in jsdom (zero layout dimensions); render tests assert on empty-state absence rather than SVG presence
- `PLChart.test.ts` inline `formatTime` updated to match implementation (removed `timeZone: "UTC"`)
