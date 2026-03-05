from typing import Optional
from sqlmodel import SQLModel, Field
import uuid
from datetime import datetime, timezone


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _uuid() -> str:
    return str(uuid.uuid4())


class UserProfile(SQLModel, table=True):
    __tablename__ = "user_profile"

    id: str = Field(default="default", primary_key=True)
    cash_balance: float = Field(default=10000.0)
    created_at: str = Field(default_factory=_now)


class Watchlist(SQLModel, table=True):
    __tablename__ = "watchlist"

    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(default="default")
    ticker: str
    added_at: str = Field(default_factory=_now)


class Position(SQLModel, table=True):
    __tablename__ = "positions"

    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(default="default")
    ticker: str
    quantity: float
    avg_cost: float
    updated_at: str = Field(default_factory=_now)


class Trade(SQLModel, table=True):
    __tablename__ = "trades"

    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(default="default")
    ticker: str
    side: str  # "buy" or "sell"
    quantity: float
    price: float
    executed_at: str = Field(default_factory=_now)


class PortfolioSnapshot(SQLModel, table=True):
    __tablename__ = "portfolio_snapshots"

    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(default="default")
    total_value: float
    recorded_at: str = Field(default_factory=_now)


class ChatMessage(SQLModel, table=True):
    __tablename__ = "chat_messages"

    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(default="default")
    role: str  # "user" or "assistant"
    content: str
    actions: Optional[str] = Field(default=None)  # JSON string
    created_at: str = Field(default_factory=_now)
