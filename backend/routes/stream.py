import asyncio
import json

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

router = APIRouter()

SSE_INTERVAL = 0.5


@router.get("/api/stream/prices")
async def price_stream(request: Request):
    provider = request.app.state.market_provider

    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                prices = provider.get_all_prices()
                for update in prices.values():
                    payload = json.dumps({
                        "ticker": update.ticker,
                        "price": update.price,
                        "prev_price": update.prev_price,
                        "prev_close": update.prev_close,
                        "change": update.change,
                        "change_pct": update.change_pct,
                        "timestamp": update.timestamp,
                    })
                    yield f"data: {payload}\n\n"
                await asyncio.sleep(SSE_INTERVAL)
        except asyncio.CancelledError:
            pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
