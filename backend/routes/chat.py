import json

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from models import ChatMessage
from services.context import load_portfolio_context
from services.executor import execute_trade, execute_watchlist_change
from services.llm import call_llm
from tasks import take_snapshot

router = APIRouter()

_HISTORY_LIMIT = 5


class ChatRequest(BaseModel):
    message: str


@router.get("/api/chat")
def get_chat_history(session: Session = Depends(get_session)):
    messages = session.exec(
        select(ChatMessage)
        .where(ChatMessage.user_id == "default")
        .order_by(ChatMessage.created_at)
    ).all()
    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "actions": json.loads(m.actions) if m.actions else None,
            "created_at": m.created_at,
        }
        for m in messages
    ]


@router.delete("/api/chat", status_code=204)
def clear_chat_history(session: Session = Depends(get_session)):
    messages = session.exec(
        select(ChatMessage).where(ChatMessage.user_id == "default")
    ).all()
    for msg in messages:
        session.delete(msg)
    session.commit()


@router.post("/api/chat", status_code=201)
def post_chat(
    body: ChatRequest,
    request: Request,
    session: Session = Depends(get_session),
):
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="message cannot be empty")

    provider = request.app.state.market_provider

    # Load history and context BEFORE saving user message (stable window, no off-by-one)
    recent = session.exec(
        select(ChatMessage)
        .where(ChatMessage.user_id == "default")
        .order_by(ChatMessage.created_at.desc())
        .limit(_HISTORY_LIMIT)
    ).all()
    history_messages = [
        {"role": m.role, "content": m.content} for m in reversed(recent)
    ]
    history_messages.append({"role": "user", "content": body.message})

    portfolio_context = load_portfolio_context(session, provider)

    # Save user message before calling LLM so it persists even if LLM fails
    user_msg = ChatMessage(user_id="default", role="user", content=body.message)
    session.add(user_msg)
    session.commit()

    # Call LLM
    try:
        llm_response = call_llm(history_messages, portfolio_context)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=f"LLM error: {exc}") from exc

    # Auto-execute trades and watchlist changes
    actions: list[dict] = []
    any_trade_succeeded = False
    for trade in llm_response.trades:
        result = execute_trade(
            session, provider,
            trade["ticker"], trade["side"], trade["quantity"]
        )
        if result["ok"]:
            any_trade_succeeded = True
        actions.append({"type": "trade", **result})

    for change in llm_response.watchlist_changes:
        result = execute_watchlist_change(
            session, provider,
            change["ticker"], change["action"]
        )
        actions.append({"type": "watchlist", **result})

    # Record portfolio snapshot after any successful trade (mirrors portfolio route)
    if any_trade_succeeded:
        take_snapshot(provider, request.app.state.engine)

    # Save assistant message
    actions_json = json.dumps(actions) if actions else None
    assistant_msg = ChatMessage(
        user_id="default",
        role="assistant",
        content=llm_response.message,
        actions=actions_json,
    )
    session.add(assistant_msg)
    session.commit()

    return {
        "id": assistant_msg.id,
        "role": "assistant",
        "content": llm_response.message,
        "actions": actions if actions else None,
        "created_at": assistant_msg.created_at,
    }
