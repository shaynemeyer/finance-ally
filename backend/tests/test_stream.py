"""Tests for SSE stream route.

The event_generator is an infinite async generator, so tests consume the
body_iterator directly — breaking after enough chunks — then close it cleanly.
"""

import json
import time
import pytest
from fastapi import FastAPI
from unittest.mock import MagicMock, AsyncMock

from market.types import PriceUpdate
from routes.stream import router, price_stream


def make_provider(prices: dict):
    provider = MagicMock()
    provider.get_all_prices.return_value = prices
    return provider


def make_request(prices: dict):
    provider = make_provider(prices)
    request = MagicMock()
    request.app.state.market_provider = provider
    request.is_disconnected = AsyncMock(return_value=False)
    return request


def sample_prices():
    now = time.time()
    return {
        "AAPL": PriceUpdate("AAPL", 190.0, 189.5, 188.0, now, 2.0, 1.06),
        "MSFT": PriceUpdate("MSFT", 415.0, 414.0, 413.0, now, 2.0, 0.48),
    }


async def collect_chunks(gen, count: int) -> list[str]:
    """Collect up to `count` non-empty chunks from an async generator, then close it."""
    chunks = []
    try:
        async for chunk in gen:
            if chunk.strip():
                chunks.append(chunk)
            if len(chunks) >= count:
                break
    finally:
        await gen.aclose()
    return chunks


async def test_generator_yields_data_lines():
    """Generator yields SSE-formatted data lines for each price in cache."""
    prices = sample_prices()
    request = make_request(prices)

    response = await price_stream(request)
    chunks = await collect_chunks(response.body_iterator, count=2)

    assert len(chunks) == 2
    tickers = set()
    for chunk in chunks:
        assert chunk.startswith("data: ")
        payload = json.loads(chunk[len("data: "):].strip())
        assert "ticker" in payload
        assert "price" in payload
        assert "prev_price" in payload
        assert "prev_close" in payload
        assert "change" in payload
        assert "change_pct" in payload
        assert "timestamp" in payload
        tickers.add(payload["ticker"])

    assert tickers == {"AAPL", "MSFT"}


async def test_generator_stops_on_disconnect():
    """Generator breaks when is_disconnected() returns True."""
    prices = sample_prices()
    request = make_request(prices)
    request.is_disconnected = AsyncMock(return_value=True)

    response = await price_stream(request)
    chunks = await collect_chunks(response.body_iterator, count=10)
    assert chunks == []


async def test_generator_empty_cache_yields_nothing():
    """Generator yields no data lines when cache is empty."""
    request = make_request({})
    # Let is_disconnected return True on the second call to exit the loop
    request.is_disconnected = AsyncMock(side_effect=[False, True])

    response = await price_stream(request)
    chunks = await collect_chunks(response.body_iterator, count=10)
    assert chunks == []


def test_stream_endpoint_registered():
    """SSE endpoint is registered at the correct path."""
    app = FastAPI()
    app.include_router(router)
    paths = [route.path for route in app.routes]
    assert "/api/stream/prices" in paths


async def test_stream_response_headers():
    """SSE endpoint returns correct media type and no-cache headers."""
    request = make_request(sample_prices())
    response = await price_stream(request)

    assert response.media_type == "text/event-stream"
    assert response.headers.get("cache-control") == "no-cache"
    assert response.headers.get("x-accel-buffering") == "no"
    await response.body_iterator.aclose()
