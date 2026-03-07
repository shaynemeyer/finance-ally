import asyncio
import time

import httpx

from config import MASSIVE_POLL_INTERVAL
from .base import MarketDataProvider
from .types import PriceUpdate

BASE_URL = "https://api.polygon.io"


class MassiveProvider(MarketDataProvider):
    def __init__(self, api_key: str) -> None:
        self._api_key = api_key
        self._tickers: set[str] = set()
        self._cache: dict[str, PriceUpdate] = {}
        self._prev_closes: dict[str, float] = {}
        self._task: asyncio.Task | None = None

    async def start(self, tickers: list[str]) -> None:
        self._tickers = {t.upper() for t in tickers}
        self._task = asyncio.create_task(self._poll_loop())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            await asyncio.gather(self._task, return_exceptions=True)

    def add_ticker(self, ticker: str) -> None:
        self._tickers.add(ticker.upper())

    def remove_ticker(self, ticker: str) -> None:
        ticker = ticker.upper()
        self._tickers.discard(ticker)
        self._cache.pop(ticker, None)
        self._prev_closes.pop(ticker, None)

    def get_price(self, ticker: str) -> PriceUpdate | None:
        return self._cache.get(ticker.upper())

    def get_all_prices(self) -> dict[str, PriceUpdate]:
        return dict(self._cache)

    async def _poll_loop(self) -> None:
        while True:
            if self._tickers:
                await self._fetch_snapshot()
            await asyncio.sleep(MASSIVE_POLL_INTERVAL)

    async def _fetch_snapshot(self) -> None:
        tickers_param = ",".join(sorted(self._tickers))
        url = f"{BASE_URL}/v2/snapshot/locale/us/markets/stocks/tickers"
        now = time.time()

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    url,
                    params={"tickers": tickers_param, "apiKey": self._api_key},
                )
                response.raise_for_status()
                data = response.json()
        except (httpx.HTTPError, ValueError):
            return

        for item in data.get("tickers", []):
            ticker = item["ticker"]
            last_trade = item.get("lastTrade") or {}
            price = last_trade.get("p") or item["day"]["c"]
            prev_close = item["prevDay"]["c"]

            if ticker not in self._prev_closes:
                self._prev_closes[ticker] = prev_close

            prev_price = self._cache[ticker].price if ticker in self._cache else price
            change = price - prev_close
            change_pct = (change / prev_close * 100) if prev_close else 0.0

            self._cache[ticker] = PriceUpdate(
                ticker=ticker,
                price=price,
                prev_price=prev_price,
                prev_close=prev_close,
                timestamp=now,
                change=round(change, 4),
                change_pct=round(change_pct, 4),
            )
