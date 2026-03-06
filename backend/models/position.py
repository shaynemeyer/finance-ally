import uuid
from sqlmodel import SQLModel, Field
from datetime import datetime, timezone


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _uuid() -> str:
    return str(uuid.uuid4())


class Position(SQLModel, table=True):
    __tablename__ = "positions"

    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(default="default")
    ticker: str
    quantity: float
    avg_cost: float
    updated_at: str = Field(default_factory=_now)
