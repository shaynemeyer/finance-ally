from dataclasses import dataclass


@dataclass
class PriceUpdate:
    ticker: str
    price: float
    prev_price: float
    prev_close: float
    timestamp: float
    change: float
    change_pct: float
