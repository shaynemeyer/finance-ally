# Code Review — FA-8: Portfolio Trading UI

Branch: `fa-8-portfolio-trading-ui`
Reviewed by: Claude Sonnet 4.6
Date: 2026-03-10

---

## Files Changed

```
frontend/src/app/page.tsx
frontend/src/components/portfolio/PLChart.tsx
frontend/src/components/portfolio/PortfolioHeatmap.tsx
frontend/src/components/portfolio/PositionsTable.tsx
frontend/src/components/trading/TradeBar.tsx
frontend/src/store/portfolioStore.ts
frontend/src/types/portfolio.ts
```

---

## Summary

FA-8 delivers the portfolio heatmap, P&L chart, positions table, and trade bar as specified in PLAN.md. The implementation is appropriately lean. The components are wired together correctly and follow the established patterns from FA-7. There are no security issues. There are several bugs and omissions worth addressing before this merges.

---

## 1. Bugs and Logic Errors

### 1.1 Infinite re-render risk in `page.tsx` — `useEffect` dependency array

**File:** `frontend/src/app/page.tsx`, lines 17–25

```ts
useEffect(() => {
  fetchPortfolio();
  fetchHistory();
  const interval = setInterval(...);
  return () => clearInterval(interval);
}, [fetchPortfolio, fetchHistory]);
```

`fetchPortfolio` and `fetchHistory` are functions defined inside `create()` in the Zustand store. Zustand stores create these functions once and they are stable references — they will not change between renders. This is safe in practice **with the current Zustand v5 implementation**, but it is fragile: if the store is ever refactored to produce new function references (e.g. using `useCallback` outside the store, or switching to `useShallow`), this will trigger an infinite polling loop. The standard pattern for Zustand actions is to extract them outside of reactive state so the dependency array is not needed. Either omit the functions from the dep array with a lint-disable comment and explanation, or extract them via `usePortfolioStore.getState()` inside the effect body to make the intent explicit.

### 1.2 P&L chart: `formatTime` uses local timezone, not UTC

**File:** `frontend/src/components/portfolio/PLChart.tsx`, line 15

```ts
function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
```

The backend records `recorded_at` as a UTC ISO string. `new Date(iso)` will parse it correctly, but `toLocaleTimeString` renders in the browser's local timezone with no explicit `timeZone` option. For a user in UTC-5, timestamps will shift 5 hours. Since there is no timezone option in the API response, the correct fix is to either pass `{ timeZone: "UTC" }` to `toLocaleTimeString` for consistency, or document that local timezone display is intentional. As written, the chart's X-axis tick labels will be wrong for any user not in UTC.

### 1.3 P&L chart: `Math.min(...values)` / `Math.max(...values)` will throw on large history arrays

**File:** `frontend/src/components/portfolio/PLChart.tsx`, lines 38–40

```ts
const values = data.map((d) => d.value);
const min = Math.min(...values);
const max = Math.max(...values);
```

The history endpoint returns up to 24 hours of snapshots recorded every 10 seconds — up to 8,640 entries. Spreading a large array into `Math.min` / `Math.max` will hit the JavaScript call stack argument limit (varies by engine, commonly 65,536) and throw a `RangeError: Maximum call stack size exceeded`. Use `Math.min(...values)` only for small arrays. Replace with `values.reduce((a, b) => Math.min(a, b))` or `Math.min.apply(null, values)` — but the most robust fix is a simple `for` loop or `Array.prototype.reduce`.

### 1.4 `TradeBar`: no `try/catch` around `fetch`

**File:** `frontend/src/components/trading/TradeBar.tsx`, lines 27–45

```ts
const res = await fetch("/api/portfolio/trade", { ... });
setIsSubmitting(false);
```

If the network request throws (e.g. server unreachable, CORS error, timeout), `setIsSubmitting` is never called and the button stays permanently disabled. The `setIsSubmitting(false)` call should be in a `finally` block. This is a real user-facing bug — after a network error, the trade UI is frozen until page reload.

### 1.5 `portfolioStore`: silent failure on Zod parse error

**File:** `frontend/src/store/portfolioStore.ts`, lines 16–28

```ts
fetchPortfolio: async () => {
  const res = await fetch("/api/portfolio");
  if (!res.ok) return;
  const data = PortfolioSchema.parse(await res.json());
  set({ portfolio: data });
},
```

`PortfolioSchema.parse(...)` will throw a `ZodError` if the API response shape changes or returns an unexpected payload. There is no `try/catch`. This will produce an unhandled promise rejection and the store state will be silently stale. The same applies to `fetchHistory`. Given the project's "no over-engineering" principle, a minimal `try/catch` that logs and returns is sufficient.

---

## 2. Test Coverage

### Covered (from FA-7, unchanged)

- `priceStore` — 6 tests, comprehensive
- `watchlistStore` — 7 tests, comprehensive
- `usePriceStream` hook — tested
- `ConnectionStatus` component — tested

### Missing — all FA-8 additions have zero tests

| What | Why it matters |
|------|---------------|
| `portfolioStore` — `fetchPortfolio` and `fetchHistory` | Core data layer for the entire portfolio UI. Fetch logic, Zod parsing, and state updates are untested. |
| `PositionsTable` | P&L color logic (`isProfit ? "+" : ""`) and fractional quantity formatting (`pos.quantity % 1 === 0`) are presentation logic with branching that should be unit-tested. |
| `PLChart` — `formatTime`, `formatValue` | Pure functions with edge cases (zero `pad`, timezone behavior). Easily unit-tested. |
| `PortfolioHeatmap` — `pnlColor` | Pure function with 7 branches, none tested. |
| `TradeBar` | Trade submission flow (success, server error, network error) should be tested with mocked fetch. |

The pattern established in FA-7 tests Zustand stores directly by resetting state in `beforeEach` and calling store actions. `portfolioStore` should follow the same pattern with a `vi.stubGlobal("fetch", ...)` mock. This is the highest-priority gap.

---

## 3. Code Quality

### 3.1 `PortfolioHeatmap`: `as any` cast on Recharts `content` prop

**File:** `frontend/src/components/portfolio/PortfolioHeatmap.tsx`, line 85

```ts
content={<HeatmapCell /> as any}
```

The `eslint-disable` comment and `as any` cast exist because Recharts' `Treemap` `content` prop typing is loose and does not accurately describe the injected render props. This is a known Recharts v3 typing gap and the cast is acceptable here — but the comment should explain why (`// Recharts injects x/y/width/height/name as render props; typings don't reflect this`) rather than just suppressing ESLint. As-is, it is functional.

### 3.2 `PositionsTable`: `overflow-hidden` on parent cuts off sticky header

**File:** `frontend/src/app/page.tsx`, line 101

```tsx
<div className="flex-1 overflow-hidden">
  <PositionsTable />
</div>
```

The `PositionsTable` inner div uses `overflow-y-auto` to scroll, and the `thead` is `sticky top-0`. However, the parent wrapper uses `overflow-hidden`, which creates a new stacking context. The sticky header will work because the scroll container is the inner `overflow-y-auto` div, not the `overflow-hidden` parent — but this is non-obvious and could break if the hierarchy changes. No immediate bug, worth a comment.

### 3.3 Inline `style` for fixed heights instead of Tailwind

**File:** `frontend/src/app/page.tsx`, lines 62, 68, 79

```tsx
style={{ height: "220px" }}
style={{ width: "260px" }}
style={{ height: "140px" }}
```

The project uses Tailwind v4 with custom CSS variables. Arbitrary values like `h-[220px]` and `w-[260px]` are idiomatic Tailwind and would be preferable over inline styles for consistency. This is a minor style issue, not a bug.

### 3.4 `page.tsx` header logic belongs in a dedicated `Header` component

The plan specifies a `components/layout/Header.tsx` (or similar) component. Portfolio value and cash balance display is currently inlined directly in `page.tsx`. As the page grows (FA-9 AI chat, FA-10 chart), `page.tsx` will become unwieldy. The header content should be extracted now, before it becomes harder. This is not blocking.

### 3.5 `TradeBar`: `lastTrade` confirmation string hardcodes `qty` (pre-parse) instead of `data.quantity` (post-fill)

**File:** `frontend/src/components/trading/TradeBar.tsx`, line 38

```ts
const total = (data.price * data.quantity).toFixed(2);
setLastTrade(`${side === "buy" ? "Bought" : "Sold"} ${qty} ${t} @ $${data.price.toFixed(2)} = $${total}`);
```

The confirmation string uses local `qty` (the raw user input, a `parseFloat` result) for the quantity display, but uses `data.quantity` for the total calculation. For normal cases they are the same, but if the backend ever rounds or adjusts quantity, the displayed quantity and the total would be inconsistent. Using `data.quantity` consistently throughout the confirmation string would be more correct.

---

## 4. Convention Adherence

| Convention | Status |
|-----------|--------|
| `'use client'` on all component files | Correct on all 4 components |
| Zustand for state | Correct — `usePortfolioStore` follows the pattern from FA-7 |
| Zod for schema validation | Correct — `PositionSchema`, `PortfolioSchema`, `SnapshotSchema` in `types/portfolio.ts` |
| ShadCN + Tailwind dark theme | Correct — uses `bg-background`, `text-foreground`, `border-border`, `text-muted-foreground` |
| Component-per-file under `components/{domain}/` | Correct |
| No over-engineering | Correct — no unnecessary abstraction layers |
| No emojis | Correct |

---

## 5. Prioritized Issues

| Priority | Issue | File |
|----------|-------|------|
| High | `TradeBar`: missing `finally` around fetch — button permanently disabled on network error | `TradeBar.tsx:27-45` |
| High | `portfolioStore`: unhandled `ZodError` on parse failure causes silent stale state | `portfolioStore.ts:19,26` |
| High | `PLChart`: `Math.min/max` spread will throw `RangeError` on large history arrays | `PLChart.tsx:39-40` |
| Medium | `PLChart`: timestamp display uses local timezone, not UTC — X-axis labels will be wrong for non-UTC users | `PLChart.tsx:15` |
| Medium | Zero unit tests for all FA-8 code (`portfolioStore`, `PortfolioHeatmap.pnlColor`, `PLChart` utils, `TradeBar`) | — |
| Low | Inline `style` heights should be Tailwind arbitrary values | `page.tsx:62,68,79` |
| Low | `page.tsx` `useEffect` dep array — fragile but not currently broken | `page.tsx:17-25` |
| Low | Header content should be extracted to a dedicated component | `page.tsx` |
