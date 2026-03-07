import asyncio
import math
import random
import time

from .base import MarketDataProvider
from .types import PriceUpdate

TICK_INTERVAL = 0.5
SECONDS_PER_YEAR = 252 * 6.5 * 3600
DT = TICK_INTERVAL / SECONDS_PER_YEAR

EVENT_PROBABILITY = 0.002
EVENT_MIN = 0.02
EVENT_MAX = 0.05

SEED_PRICES: dict[str, float] = {
    "AAPL":  190.0,
    "GOOGL": 175.0,
    "MSFT":  415.0,
    "AMZN":  185.0,
    "TSLA":  250.0,
    "NVDA":  875.0,
    "META":  505.0,
    "JPM":   195.0,
    "V":     275.0,
    "NFLX":  620.0,
}

TICKER_PARAMS: dict[str, tuple[float, float]] = {
    "AAPL":  (0.08, 0.28),
    "GOOGL": (0.07, 0.30),
    "MSFT":  (0.09, 0.26),
    "AMZN":  (0.10, 0.32),
    "TSLA":  (0.05, 0.65),
    "NVDA":  (0.15, 0.55),
    "META":  (0.10, 0.38),
    "JPM":   (0.06, 0.22),
    "V":     (0.07, 0.20),
    "NFLX":  (0.08, 0.40),
}

TICKER_RHO: dict[str, float] = {
    "AAPL": 0.6, "GOOGL": 0.6, "MSFT": 0.6, "AMZN": 0.6,
    "META": 0.6, "NVDA": 0.6, "NFLX": 0.6,
    "TSLA": 0.4,
    "JPM": 0.3, "V": 0.3,
}

DEFAULT_PARAMS: tuple[float, float] = (0.07, 0.35)
DEFAULT_RHO = 0.5


class SimulatorProvider(MarketDataProvider):
    def __init__(self) -> None:
        self._prices: dict[str, float] = {}
        self._prev_closes: dict[str, float] = {}
        self._cache: dict[str, PriceUpdate] = {}
        self._tickers: set[str] = set()
        self._task: asyncio.Task | None = None

    async def start(self, tickers: list[str]) -> None:
        for ticker in tickers:
            self._init_ticker(ticker)
        self._tickers = {t.upper() for t in tickers}
        self._task = asyncio.create_task(self._tick_loop())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            await asyncio.gather(self._task, return_exceptions=True)

    def add_ticker(self, ticker: str) -> None:
        ticker = ticker.upper()
        if ticker not in self._tickers:
            self._init_ticker(ticker)
            self._tickers.add(ticker)

    def remove_ticker(self, ticker: str) -> None:
        ticker = ticker.upper()
        self._tickers.discard(ticker)
        self._prices.pop(ticker, None)
        self._prev_closes.pop(ticker, None)
        self._cache.pop(ticker, None)

    def get_price(self, ticker: str) -> PriceUpdate | None:
        return self._cache.get(ticker.upper())

    def get_all_prices(self) -> dict[str, PriceUpdate]:
        return dict(self._cache)

    def _init_ticker(self, ticker: str) -> None:
        ticker = ticker.upper()
        seed = SEED_PRICES.get(ticker, 100.0)
        self._prices[ticker] = seed
        self._prev_closes[ticker] = seed

    async def _tick_loop(self) -> None:
        while True:
            self._tick()
            await asyncio.sleep(TICK_INTERVAL)

    def _tick(self) -> None:
        now = time.time()
        z_market = random.gauss(0, 1)

        for ticker in list(self._tickers):
            mu, sigma = TICKER_PARAMS.get(ticker, DEFAULT_PARAMS)
            rho = TICKER_RHO.get(ticker, DEFAULT_RHO)

            z_idio = random.gauss(0, 1)
            z = rho * z_market + math.sqrt(1 - rho ** 2) * z_idio

            drift = (mu - 0.5 * sigma ** 2) * DT
            diffusion = sigma * math.sqrt(DT) * z

            prev_price = self._prices[ticker]
            new_price = prev_price * math.exp(drift + diffusion)
            new_price = _apply_event(new_price)
            new_price = max(new_price, 0.01)

            self._prices[ticker] = new_price

            prev_close = self._prev_closes[ticker]
            change = new_price - prev_close
            change_pct = (change / prev_close * 100) if prev_close else 0.0

            self._cache[ticker] = PriceUpdate(
                ticker=ticker,
                price=round(new_price, 2),
                prev_price=round(prev_price, 2),
                prev_close=round(prev_close, 2),
                timestamp=now,
                change=round(change, 4),
                change_pct=round(change_pct, 4),
            )


def _apply_event(price: float) -> float:
    if random.random() < EVENT_PROBABILITY:
        direction = 1 if random.random() > 0.5 else -1
        magnitude = random.uniform(EVENT_MIN, EVENT_MAX)
        return price * (1 + direction * magnitude)
    return price
