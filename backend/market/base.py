from abc import ABC, abstractmethod
from .types import PriceUpdate


class MarketDataProvider(ABC):
    """Abstract base for market data sources."""

    @abstractmethod
    async def start(self, tickers: list[str]) -> None:
        """Start background polling/simulation for the given tickers."""
        ...

    @abstractmethod
    async def stop(self) -> None:
        """Stop background task and release resources."""
        ...

    @abstractmethod
    def add_ticker(self, ticker: str) -> None:
        """Add a ticker to the active set. Takes effect on next poll/tick."""
        ...

    @abstractmethod
    def remove_ticker(self, ticker: str) -> None:
        """Remove a ticker from the active set and delete it from the cache."""
        ...

    @abstractmethod
    def get_price(self, ticker: str) -> PriceUpdate | None:
        """Return the latest cached PriceUpdate for a ticker, or None."""
        ...

    @abstractmethod
    def get_all_prices(self) -> dict[str, PriceUpdate]:
        """Return the full price cache: {ticker: PriceUpdate}."""
        ...
