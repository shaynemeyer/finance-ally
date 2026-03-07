from config import MASSIVE_API_KEY
from .base import MarketDataProvider
from .massive import MassiveProvider
from .simulator import SimulatorProvider


def create_provider() -> MarketDataProvider:
    """Return MassiveProvider if MASSIVE_API_KEY is set, else SimulatorProvider."""
    if MASSIVE_API_KEY:
        return MassiveProvider(api_key=MASSIVE_API_KEY)
    return SimulatorProvider()
