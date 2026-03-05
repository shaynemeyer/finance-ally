from sqlmodel import SQLModel, Field
from datetime import datetime, timezone


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class UserProfile(SQLModel, table=True):
    __tablename__ = "user_profile"

    id: str = Field(default="default", primary_key=True)
    cash_balance: float = Field(default=10000.0)
    created_at: str = Field(default_factory=_now)
