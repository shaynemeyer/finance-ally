import uuid
from typing import Optional
from sqlmodel import SQLModel, Field
from datetime import datetime, timezone


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _uuid() -> str:
    return str(uuid.uuid4())


class ChatMessage(SQLModel, table=True):
    __tablename__ = "chat_messages"

    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(default="default")
    role: str  # "user" or "assistant"
    content: str
    actions: Optional[str] = Field(default=None)  # JSON string
    created_at: str = Field(default_factory=_now)
