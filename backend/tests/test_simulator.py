import asyncio
import pytest
from market.simulator import SimulatorProvider, SEED_PRICES, TICK_INTERVAL


@pytest.fixture
def sim():
    return SimulatorProvider()


def test_init_ticker_known(sim):
    sim._init_ticker("AAPL")
    assert sim._prices["AAPL"] == SEED_PRICES["AAPL"]
    assert sim._prev_closes["AAPL"] == SEED_PRICES["AAPL"]


def test_init_ticker_unknown(sim):
    sim._init_ticker("XYZ")
    assert sim._prices["XYZ"] == 100.0
    assert sim._prev_closes["XYZ"] == 100.0


def test_tick_populates_cache(sim):
    sim._prices["AAPL"] = 190.0
    sim._prev_closes["AAPL"] = 190.0
    sim._tickers = {"AAPL"}
    sim._tick()
    assert "AAPL" in sim._cache
    update = sim._cache["AAPL"]
    assert update.ticker == "AAPL"
    assert update.price > 0
    assert update.prev_price == 190.0
    assert update.prev_close == 190.0


def test_tick_price_floor(sim):
    """Price should never go below $0.01."""
    sim._prices["AAPL"] = 0.001
    sim._prev_closes["AAPL"] = 190.0
    sim._tickers = {"AAPL"}
    for _ in range(20):
        sim._tick()
        assert sim._cache["AAPL"].price >= 0.01


def test_add_ticker(sim):
    sim.add_ticker("MSFT")
    assert "MSFT" in sim._tickers
    assert sim._prices["MSFT"] == SEED_PRICES["MSFT"]


def test_add_ticker_idempotent(sim):
    sim.add_ticker("AAPL")
    sim._prices["AAPL"] = 999.0
    sim.add_ticker("AAPL")  # should not reset price
    assert sim._prices["AAPL"] == 999.0


def test_remove_ticker(sim):
    sim.add_ticker("TSLA")
    sim._tickers.add("TSLA")
    sim._tick()
    sim.remove_ticker("TSLA")
    assert "TSLA" not in sim._tickers
    assert "TSLA" not in sim._prices
    assert "TSLA" not in sim._cache


def test_get_price_none_before_tick(sim):
    sim.add_ticker("NVDA")
    assert sim.get_price("NVDA") is None


def test_get_price_after_tick(sim):
    sim._prices["NVDA"] = 875.0
    sim._prev_closes["NVDA"] = 875.0
    sim._tickers = {"NVDA"}
    sim._tick()
    update = sim.get_price("NVDA")
    assert update is not None
    assert update.ticker == "NVDA"


def test_get_all_prices(sim):
    sim._prices = {"AAPL": 190.0, "MSFT": 415.0}
    sim._prev_closes = {"AAPL": 190.0, "MSFT": 415.0}
    sim._tickers = {"AAPL", "MSFT"}
    sim._tick()
    prices = sim.get_all_prices()
    assert "AAPL" in prices
    assert "MSFT" in prices
    assert len(prices) == 2


def test_change_pct_calculation(sim):
    sim._prices["AAPL"] = 190.0
    sim._prev_closes["AAPL"] = 190.0
    sim._tickers = {"AAPL"}
    sim._tick()
    update = sim._cache["AAPL"]
    expected_pct = (update.change / update.prev_close * 100)
    assert abs(update.change_pct - expected_pct) < 0.001


async def test_start_stop():
    sim = SimulatorProvider()
    await sim.start(["AAPL", "GOOGL"])
    await asyncio.sleep(0.6)  # let one tick run
    assert "AAPL" in sim._cache
    assert "GOOGL" in sim._cache
    await sim.stop()
    assert sim._task.cancelled() or sim._task.done()


async def test_correlated_moves():
    """Multiple tickers should all have cache entries after a tick."""
    sim = SimulatorProvider()
    await sim.start(["AAPL", "MSFT", "NVDA"])
    await asyncio.sleep(0.6)
    prices = sim.get_all_prices()
    assert len(prices) == 3
    await sim.stop()
