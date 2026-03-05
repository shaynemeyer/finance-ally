# Massive API (formerly Polygon.io) — Stock Price Reference

Polygon.io rebranded as Massive on Oct 30, 2025. Existing Polygon API keys continue to work unchanged.

**Docs:** https://massive.com/docs/rest/stocks/overview
**Rate limits:** https://massive.com/knowledge-base/article/what-is-the-request-limit-for-massives-restful-apis

---

## Authentication

Base URL: `https://api.polygon.io` (still active) or `https://api.massive.com` (new)

Pass the API key either as a query parameter or an HTTP header:

```
# Query parameter
GET https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=AAPL,MSFT&apiKey=YOUR_KEY

# Authorization header (preferred)
Authorization: Bearer YOUR_KEY
```

---

## Rate Limits

| Tier   | Limit                                       |
|--------|---------------------------------------------|
| Free   | 5 requests / minute                         |
| Paid   | Unlimited (stay under 100 requests / second)|

Free tier also only returns end-of-day data (no real-time). Real-time prices require a paid subscription.

---

## Key Endpoints

### 1. Full Market Snapshot — current prices for specific tickers

**Best endpoint for polling a watchlist of tickers in a single call.**

```
GET /v2/snapshot/locale/us/markets/stocks/tickers
```

| Parameter    | Type    | Required | Description                                         |
|-------------|---------|----------|-----------------------------------------------------|
| `tickers`   | string  | No       | Comma-separated tickers: `AAPL,TSLA,NVDA`. Omit for all. |
| `include_otc`| boolean | No       | Include OTC securities (default false)              |
| `apiKey`    | string  | Yes*     | API key (or use Authorization header)               |

**Response schema:**

```json
{
  "count": 2,
  "status": "OK",
  "tickers": [
    {
      "ticker": "AAPL",
      "day": {
        "o": 189.30,
        "h": 191.05,
        "l": 188.90,
        "c": 190.54,
        "v": 52341876,
        "vw": 190.12
      },
      "prevDay": {
        "o": 188.00,
        "h": 190.20,
        "l": 187.50,
        "c": 189.30,
        "v": 48200000,
        "vw": 188.95
      },
      "min": {
        "o": 190.40,
        "h": 190.60,
        "l": 190.30,
        "c": 190.54,
        "v": 12300,
        "vw": 190.48,
        "t": 1705594800000
      },
      "lastTrade": {
        "p": 190.54,
        "s": 100,
        "t": 1705594850123456789
      },
      "lastQuote": {
        "P": 190.55,
        "p": 190.54,
        "S": 5,
        "s": 8,
        "t": 1705594850200000000
      },
      "todaysChange": 1.24,
      "todaysChangePerc": 0.655,
      "updated": 1705594850123456789
    }
  ]
}
```

Key fields extracted per ticker:

| Path                    | Meaning                              |
|------------------------|--------------------------------------|
| `ticker`               | Ticker symbol                        |
| `lastTrade.p`          | Latest trade price                   |
| `day.c`                | Current day's most recent close/bar  |
| `day.o`                | Today's open                         |
| `prevDay.c`            | Previous day close (for % change)    |
| `todaysChange`         | Absolute change from prior day close |
| `todaysChangePerc`     | Percentage change from prior day     |
| `updated`              | Nanosecond Unix timestamp            |

---

### 2. Previous Day Bar — single ticker

```
GET /v2/aggs/ticker/{stocksTicker}/prev
```

| Parameter      | Type    | Required | Description              |
|---------------|---------|----------|--------------------------|
| `stocksTicker`| string  | Yes (path)| Ticker symbol e.g. `AAPL`|
| `adjusted`    | boolean | No       | Split-adjusted (default true)|

**Example response:**

```json
{
  "status": "OK",
  "resultsCount": 1,
  "results": [
    {
      "T": "AAPL",
      "o": 188.00,
      "h": 190.20,
      "l": 187.50,
      "c": 189.30,
      "v": 48200000,
      "vw": 188.95,
      "n": 412389,
      "t": 1705536000000
    }
  ]
}
```

---

### 3. Daily Ticker Summary (OHLC + pre/after market)

```
GET /v1/open-close/{stocksTicker}/{date}
```

| Parameter      | Type   | Required | Description                        |
|---------------|--------|----------|------------------------------------|
| `stocksTicker`| string | Yes      | Ticker symbol                      |
| `date`        | string | Yes      | Date in `YYYY-MM-DD` format        |
| `adjusted`    | boolean| No       | Split-adjusted (default true)      |

**Example response:**

```json
{
  "status": "OK",
  "symbol": "AAPL",
  "from": "2024-01-18",
  "open": 188.00,
  "high": 190.20,
  "low": 187.50,
  "close": 189.30,
  "volume": 48200000,
  "afterHours": 189.85,
  "preMarket": 188.50
}
```

---

### 4. Daily Market Summary — all tickers for a date

```
GET /v2/aggs/grouped/locale/us/market/stocks/{date}
```

| Parameter    | Type    | Required | Description                           |
|-------------|---------|----------|---------------------------------------|
| `date`      | string  | Yes      | Trading date `YYYY-MM-DD`             |
| `adjusted`  | boolean | No       | Split-adjusted (default true)         |
| `include_otc`| boolean | No      | Include OTC securities (default false)|

**Example response:**

```json
{
  "status": "OK",
  "adjusted": true,
  "queryCount": 3,
  "resultsCount": 3,
  "results": [
    {
      "T": "AAPL",
      "o": 188.00,
      "h": 190.20,
      "l": 187.50,
      "c": 189.30,
      "v": 48200000,
      "vw": 188.95,
      "n": 412389,
      "t": 1705536000000
    }
  ]
}
```

---

### 5. Custom Bars (OHLC over a date range)

Useful for chart history.

```
GET /v2/aggs/ticker/{stocksTicker}/range/{multiplier}/{timespan}/{from}/{to}
```

| Parameter      | Type    | Required | Description                                              |
|---------------|---------|----------|----------------------------------------------------------|
| `stocksTicker`| string  | Yes      | Ticker symbol                                            |
| `multiplier`  | integer | Yes      | Size of the timespan multiplier (e.g. `1`)               |
| `timespan`    | string  | Yes      | `minute`, `hour`, `day`, `week`, `month`, `quarter`, `year` |
| `from`        | string  | Yes      | Start date `YYYY-MM-DD`                                  |
| `to`          | string  | Yes      | End date `YYYY-MM-DD`                                    |
| `adjusted`    | boolean | No       | Split-adjusted (default true)                            |
| `sort`        | string  | No       | `asc` or `desc`                                          |
| `limit`       | integer | No       | Max results (default 5000, max 50000)                    |

**Example:** Get daily bars for AAPL over the last 30 days:

```
GET /v2/aggs/ticker/AAPL/range/1/day/2024-01-01/2024-01-31?adjusted=true&sort=asc&apiKey=YOUR_KEY
```

---

## Python Examples (raw httpx, no client library)

```python
import httpx

BASE_URL = "https://api.polygon.io"

def get_snapshot(tickers: list[str], api_key: str) -> dict:
    """Fetch current prices for multiple tickers in one call."""
    tickers_param = ",".join(tickers)
    url = f"{BASE_URL}/v2/snapshot/locale/us/markets/stocks/tickers"
    response = httpx.get(
        url,
        params={"tickers": tickers_param, "apiKey": api_key},
        timeout=10.0,
    )
    response.raise_for_status()
    return response.json()


def get_previous_close(ticker: str, api_key: str) -> dict:
    """Fetch previous day's OHLC for a single ticker."""
    url = f"{BASE_URL}/v2/aggs/ticker/{ticker}/prev"
    response = httpx.get(
        url,
        params={"adjusted": "true", "apiKey": api_key},
        timeout=10.0,
    )
    response.raise_for_status()
    return response.json()


def get_daily_bars(ticker: str, from_date: str, to_date: str, api_key: str) -> dict:
    """Fetch daily OHLC bars for a ticker over a date range."""
    url = f"{BASE_URL}/v2/aggs/ticker/{ticker}/range/1/day/{from_date}/{to_date}"
    response = httpx.get(
        url,
        params={"adjusted": "true", "sort": "asc", "apiKey": api_key},
        timeout=10.0,
    )
    response.raise_for_status()
    return response.json()
```

## Python Examples (official massive client)

Install: `pip install massive`

```python
from massive import RESTClient

client = RESTClient(api_key="YOUR_KEY")

# Latest price for a single ticker
trade = client.get_last_trade(ticker="AAPL")
print(trade.price)

# Snapshot for all tickers (returns iterator)
for snap in client.list_snapshot_all_tickers(market_type="stocks"):
    print(snap.ticker, snap.last_trade.price, snap.todays_change_perc)

# Previous day bar
result = client.get_previous_close("AAPL")
for bar in result.results:
    print(bar.ticker, bar.close)

# Daily bars
aggs = client.list_aggs("AAPL", 1, "day", "2024-01-01", "2024-01-31")
for bar in aggs:
    print(bar.timestamp, bar.open, bar.close)
```

---

## Notes on Free Tier Polling

With only 5 requests/minute, a polling loop must be conservative:

```python
import time

POLL_INTERVAL_SECONDS = 15  # 4 calls/min leaves buffer for other requests

while True:
    data = get_snapshot(watchlist_tickers, api_key)
    process(data)
    time.sleep(POLL_INTERVAL_SECONDS)
```

One call to `/v2/snapshot/locale/us/markets/stocks/tickers` fetches all watched tickers simultaneously — no need for per-ticker calls.
