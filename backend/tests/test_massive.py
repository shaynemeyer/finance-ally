import asyncio
import pytest
import respx
import httpx
from market.massive import MassiveProvider, BASE_URL


MOCK_SNAPSHOT = {
    "tickers": [
        {
            "ticker": "AAPL",
            "lastTrade": {"p": 191.5},
            "day": {"c": 191.0},
            "prevDay": {"c": 189.0},
        },
        {
            "ticker": "MSFT",
            "lastTrade": None,
            "day": {"c": 416.0},
            "prevDay": {"c": 414.0},
        },
    ]
}


@pytest.fixture
def provider():
    return MassiveProvider(api_key="test-key")


def test_add_ticker(provider):
    provider.add_ticker("aapl")
    assert "AAPL" in provider._tickers


def test_remove_ticker(provider):
    provider._tickers.add("AAPL")
    provider._cache["AAPL"] = object()
    provider._prev_closes["AAPL"] = 189.0
    provider.remove_ticker("AAPL")
    assert "AAPL" not in provider._tickers
    assert "AAPL" not in provider._cache
    assert "AAPL" not in provider._prev_closes


def test_get_price_empty(provider):
    assert provider.get_price("AAPL") is None


def test_get_all_prices_empty(provider):
    assert provider.get_all_prices() == {}


@respx.mock
async def test_fetch_snapshot_populates_cache(provider):
    url = f"{BASE_URL}/v2/snapshot/locale/us/markets/stocks/tickers"
    respx.get(url).mock(return_value=httpx.Response(200, json=MOCK_SNAPSHOT))

    provider._tickers = {"AAPL", "MSFT"}
    await provider._fetch_snapshot()

    aapl = provider.get_price("AAPL")
    assert aapl is not None
    assert aapl.price == 191.5
    assert aapl.prev_close == 189.0
    assert round(aapl.change, 4) == round(191.5 - 189.0, 4)

    msft = provider.get_price("MSFT")
    assert msft is not None
    assert msft.price == 416.0  # falls back to day.c when lastTrade is None


@respx.mock
async def test_prev_close_seeded_on_first_poll(provider):
    url = f"{BASE_URL}/v2/snapshot/locale/us/markets/stocks/tickers"
    respx.get(url).mock(return_value=httpx.Response(200, json=MOCK_SNAPSHOT))

    provider._tickers = {"AAPL"}
    await provider._fetch_snapshot()
    assert provider._prev_closes.get("AAPL") == 189.0

    # Second poll with same data — prev_close should not change
    respx.get(url).mock(return_value=httpx.Response(200, json=MOCK_SNAPSHOT))
    await provider._fetch_snapshot()
    assert provider._prev_closes.get("AAPL") == 189.0


@respx.mock
async def test_http_error_keeps_stale_cache(provider):
    url = f"{BASE_URL}/v2/snapshot/locale/us/markets/stocks/tickers"
    respx.get(url).mock(return_value=httpx.Response(500))

    # Pre-populate cache
    from market.types import PriceUpdate
    import time
    stale = PriceUpdate("AAPL", 190.0, 189.0, 188.0, time.time(), 2.0, 1.06)
    provider._cache["AAPL"] = stale
    provider._tickers = {"AAPL"}

    await provider._fetch_snapshot()
    assert provider.get_price("AAPL") is stale  # cache unchanged


@respx.mock
async def test_start_stop(provider):
    url = f"{BASE_URL}/v2/snapshot/locale/us/markets/stocks/tickers"
    respx.get(url).mock(return_value=httpx.Response(200, json={"tickers": []}))

    await provider.start(["AAPL"])
    assert provider._task is not None
    await provider.stop()
    assert provider._task.done()
