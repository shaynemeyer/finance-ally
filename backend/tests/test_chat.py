"""Tests for FA-6: LLM chat endpoints, executor, context loader, mock mode."""
import json
from unittest.mock import patch

import pytest
import respx
import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, StaticPool, create_engine, select

from database import get_session
from models import ChatMessage, Position, UserProfile, Watchlist
from models.seed import seed_data
from routes.chat import router
from services.executor import execute_trade, execute_watchlist_change
from services.llm import LLMResponse, call_llm


# ---------------------------------------------------------------------------
# Shared test infrastructure
# ---------------------------------------------------------------------------


class FakePrice:
    def __init__(self, price: float):
        self.price = price


class FakeProvider:
    def __init__(self, prices: dict[str, float] | None = None):
        self._prices = prices or {"AAPL": 150.0, "TSLA": 200.0}
        self.added: list[str] = []
        self.removed: list[str] = []

    def get_price(self, ticker: str):
        if ticker in self._prices:
            return FakePrice(self._prices[ticker])
        return None

    def add_ticker(self, ticker: str):
        self._prices[ticker] = 100.0
        self.added.append(ticker)

    def remove_ticker(self, ticker: str):
        self._prices.pop(ticker, None)
        self.removed.append(ticker)


def make_app(prices: dict[str, float] | None = None):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        seed_data(s)

    app = FastAPI()
    app.include_router(router)
    provider = FakeProvider(prices)
    app.state.market_provider = provider
    app.state.engine = engine

    def override_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    return app, engine, provider


@pytest.fixture
def client_and_engine():
    app, engine, _ = make_app()
    with TestClient(app) as c:
        yield c, engine


@pytest.fixture
def client_engine_provider():
    app, engine, provider = make_app()
    with TestClient(app) as c:
        yield c, engine, provider


# ---------------------------------------------------------------------------
# GET /api/chat
# ---------------------------------------------------------------------------


def test_get_chat_history_empty(client_and_engine):
    client, _ = client_and_engine
    response = client.get("/api/chat")
    assert response.status_code == 200
    assert response.json() == []


def test_get_chat_history_returns_messages(client_and_engine):
    client, engine = client_and_engine
    with Session(engine) as session:
        session.add(ChatMessage(user_id="default", role="user", content="hello"))
        session.add(ChatMessage(user_id="default", role="assistant", content="hi there"))
        session.commit()

    response = client.get("/api/chat")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["role"] == "user"
    assert data[0]["content"] == "hello"
    assert data[1]["role"] == "assistant"
    assert data[1]["content"] == "hi there"
    assert "id" in data[0]
    assert "created_at" in data[0]


def test_get_chat_history_includes_actions(client_and_engine):
    client, engine = client_and_engine
    actions = json.dumps([{"type": "trade", "ok": True, "ticker": "AAPL"}])
    with Session(engine) as session:
        session.add(ChatMessage(
            user_id="default", role="assistant",
            content="Buying AAPL", actions=actions
        ))
        session.commit()

    response = client.get("/api/chat")
    data = response.json()
    assert data[0]["actions"] == [{"type": "trade", "ok": True, "ticker": "AAPL"}]


# ---------------------------------------------------------------------------
# POST /api/chat — mock mode
# ---------------------------------------------------------------------------


def test_post_chat_returns_assistant_message(client_and_engine):
    client, engine = client_and_engine
    mock_response = LLMResponse(
        message="I can help you analyze your portfolio.",
        trades=[],
        watchlist_changes=[],
    )
    with patch("routes.chat.call_llm", return_value=mock_response):
        response = client.post("/api/chat", json={"message": "Hello"})

    assert response.status_code == 201
    data = response.json()
    assert data["role"] == "assistant"
    assert data["content"] == "I can help you analyze your portfolio."
    assert data["actions"] is None


def test_post_chat_saves_both_messages(client_and_engine):
    client, engine = client_and_engine
    mock_response = LLMResponse(message="Got it.", trades=[], watchlist_changes=[])
    with patch("routes.chat.call_llm", return_value=mock_response):
        client.post("/api/chat", json={"message": "Buy AAPL"})

    with Session(engine) as session:
        msgs = session.exec(
            select(ChatMessage).order_by(ChatMessage.created_at)
        ).all()
    assert len(msgs) == 2
    assert msgs[0].role == "user"
    assert msgs[0].content == "Buy AAPL"
    assert msgs[1].role == "assistant"
    assert msgs[1].content == "Got it."


def test_post_chat_empty_message_returns_400(client_and_engine):
    client, _ = client_and_engine
    response = client.post("/api/chat", json={"message": "   "})
    assert response.status_code == 400


def test_post_chat_llm_error_returns_502(client_and_engine):
    client, _ = client_and_engine
    with patch("routes.chat.call_llm", side_effect=ValueError("OpenRouter HTTP 429")):
        response = client.post("/api/chat", json={"message": "Hello"})
    assert response.status_code == 502
    assert "LLM error" in response.json()["detail"]


# ---------------------------------------------------------------------------
# POST /api/chat — trade auto-execution
# ---------------------------------------------------------------------------


def test_post_chat_executes_valid_trade(client_and_engine):
    client, engine = client_and_engine
    mock_response = LLMResponse(
        message="Buying 2 AAPL for you.",
        trades=[{"ticker": "AAPL", "side": "buy", "quantity": 2}],
        watchlist_changes=[],
    )
    with patch("routes.chat.call_llm", return_value=mock_response):
        response = client.post("/api/chat", json={"message": "Buy some AAPL"})

    assert response.status_code == 201
    data = response.json()
    assert data["actions"] is not None
    trade_action = data["actions"][0]
    assert trade_action["type"] == "trade"
    assert trade_action["ok"] is True
    assert trade_action["ticker"] == "AAPL"

    with Session(engine) as session:
        user = session.get(UserProfile, "default")
        assert user.cash_balance == pytest.approx(10000.0 - 2 * 150.0)
        pos = session.exec(select(Position).where(Position.ticker == "AAPL")).first()
        assert pos.quantity == 2


def test_post_chat_trade_insufficient_cash_captured_in_actions(client_and_engine):
    client, engine = client_and_engine
    mock_response = LLMResponse(
        message="Trying to buy a lot.",
        trades=[{"ticker": "AAPL", "side": "buy", "quantity": 100000}],
        watchlist_changes=[],
    )
    with patch("routes.chat.call_llm", return_value=mock_response):
        response = client.post("/api/chat", json={"message": "Buy lots of AAPL"})

    assert response.status_code == 201
    data = response.json()
    action = data["actions"][0]
    assert action["ok"] is False
    assert "Insufficient cash" in action["error"]


def test_post_chat_trade_no_price_data_captured_in_actions(client_and_engine):
    client, engine = client_and_engine
    mock_response = LLMResponse(
        message="Buying FAKE.",
        trades=[{"ticker": "FAKE", "side": "buy", "quantity": 1}],
        watchlist_changes=[],
    )
    with patch("routes.chat.call_llm", return_value=mock_response):
        response = client.post("/api/chat", json={"message": "Buy FAKE"})

    assert response.status_code == 201
    action = response.json()["actions"][0]
    assert action["ok"] is False


# ---------------------------------------------------------------------------
# POST /api/chat — watchlist auto-execution
# ---------------------------------------------------------------------------


def test_post_chat_executes_watchlist_add(client_engine_provider):
    client, engine, provider = client_engine_provider
    mock_response = LLMResponse(
        message="Added PYPL to your watchlist.",
        trades=[],
        watchlist_changes=[{"ticker": "PYPL", "action": "add"}],
    )
    with patch("routes.chat.call_llm", return_value=mock_response):
        response = client.post("/api/chat", json={"message": "Watch PYPL"})

    assert response.status_code == 201
    action = response.json()["actions"][0]
    assert action["type"] == "watchlist"
    assert action["ok"] is True
    assert "PYPL" in provider.added


def test_post_chat_executes_watchlist_remove(client_engine_provider):
    client, engine, provider = client_engine_provider
    mock_response = LLMResponse(
        message="Removed AAPL from watchlist.",
        trades=[],
        watchlist_changes=[{"ticker": "AAPL", "action": "remove"}],
    )
    with patch("routes.chat.call_llm", return_value=mock_response):
        response = client.post("/api/chat", json={"message": "Stop watching AAPL"})

    assert response.status_code == 201
    action = response.json()["actions"][0]
    assert action["ok"] is True
    assert "AAPL" in provider.removed


def test_post_chat_snapshot_taken_after_successful_trade(client_and_engine):
    client, engine = client_and_engine
    mock_response = LLMResponse(
        message="Bought AAPL.",
        trades=[{"ticker": "AAPL", "side": "buy", "quantity": 1}],
        watchlist_changes=[],
    )
    from models import PortfolioSnapshot
    with patch("routes.chat.call_llm", return_value=mock_response):
        client.post("/api/chat", json={"message": "Buy 1 AAPL"})

    with Session(engine) as session:
        snapshots = session.exec(select(PortfolioSnapshot)).all()
        assert len(snapshots) == 1


def test_post_chat_actions_saved_to_db(client_and_engine):
    client, engine = client_and_engine
    mock_response = LLMResponse(
        message="Done.",
        trades=[{"ticker": "AAPL", "side": "buy", "quantity": 1}],
        watchlist_changes=[],
    )
    with patch("routes.chat.call_llm", return_value=mock_response):
        client.post("/api/chat", json={"message": "Buy 1 AAPL"})

    with Session(engine) as session:
        assistant = session.exec(
            select(ChatMessage).where(ChatMessage.role == "assistant")
        ).first()
        assert assistant.actions is not None
        actions = json.loads(assistant.actions)
        assert actions[0]["type"] == "trade"


# ---------------------------------------------------------------------------
# services/llm.py — unit tests
# ---------------------------------------------------------------------------


def test_call_llm_mock_mode_returns_deterministic_response():
    with patch("services.llm.LLM_MOCK", True):
        result = call_llm([], "")
    assert result.message == "I can help you analyze your portfolio."
    assert result.trades == []
    assert result.watchlist_changes == []


@respx.mock
def test_call_llm_real_parses_structured_response():
    payload = {
        "choices": [{
            "message": {
                "content": json.dumps({
                    "message": "Buy AAPL",
                    "trades": [{"ticker": "AAPL", "side": "buy", "quantity": 5}],
                    "watchlist_changes": [],
                })
            }
        }]
    }
    respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=httpx.Response(200, json=payload)
    )
    with patch("services.llm.LLM_MOCK", False):
        result = call_llm([{"role": "user", "content": "Buy AAPL"}], "cash: $10000")

    assert result.message == "Buy AAPL"
    assert len(result.trades) == 1
    assert result.trades[0]["ticker"] == "AAPL"
    assert result.watchlist_changes == []


@respx.mock
def test_call_llm_handles_missing_optional_fields():
    payload = {
        "choices": [{
            "message": {
                "content": json.dumps({
                    "message": "Hello",
                    "trades": [],
                    "watchlist_changes": [],
                })
            }
        }]
    }
    respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=httpx.Response(200, json=payload)
    )
    with patch("services.llm.LLM_MOCK", False):
        result = call_llm([], "")

    assert result.message == "Hello"
    assert result.trades == []
    assert result.watchlist_changes == []


@respx.mock
def test_call_llm_raises_on_malformed_response():
    payload = {"choices": [{"message": {"content": "not json"}}]}
    respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=httpx.Response(200, json=payload)
    )
    with patch("services.llm.LLM_MOCK", False):
        with pytest.raises(ValueError, match="Malformed LLM response"):
            call_llm([], "")


# ---------------------------------------------------------------------------
# services/executor.py — unit tests
# ---------------------------------------------------------------------------


def make_executor_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        seed_data(s)
    return engine


def test_execute_trade_buy_success():
    engine = make_executor_session()
    provider = FakeProvider({"AAPL": 150.0})
    with Session(engine) as session:
        result = execute_trade(session, provider, "AAPL", "buy", 2)
    assert result["ok"] is True
    assert result["ticker"] == "AAPL"
    assert result["quantity"] == 2
    assert result["price"] == 150.0


def test_execute_trade_buy_insufficient_cash():
    engine = make_executor_session()
    provider = FakeProvider({"AAPL": 150.0})
    with Session(engine) as session:
        result = execute_trade(session, provider, "AAPL", "buy", 100000)
    assert result["ok"] is False
    assert "Insufficient cash" in result["error"]


def test_execute_trade_sell_success():
    engine = make_executor_session()
    provider = FakeProvider({"AAPL": 150.0})
    with Session(engine) as session:
        session.add(Position(user_id="default", ticker="AAPL", quantity=5, avg_cost=100.0))
        session.commit()

    with Session(engine) as session:
        result = execute_trade(session, provider, "AAPL", "sell", 3)
    assert result["ok"] is True
    assert result["side"] == "sell"


def test_execute_trade_sell_insufficient_shares():
    engine = make_executor_session()
    provider = FakeProvider({"AAPL": 150.0})
    with Session(engine) as session:
        result = execute_trade(session, provider, "AAPL", "sell", 1)
    assert result["ok"] is False
    assert "Insufficient shares" in result["error"]


def test_execute_trade_no_price_data():
    engine = make_executor_session()
    provider = FakeProvider({})
    with Session(engine) as session:
        result = execute_trade(session, provider, "FAKE", "buy", 1)
    assert result["ok"] is False


def test_execute_trade_invalid_side():
    engine = make_executor_session()
    provider = FakeProvider({"AAPL": 150.0})
    with Session(engine) as session:
        result = execute_trade(session, provider, "AAPL", "hold", 1)
    assert result["ok"] is False


def test_execute_trade_ticker_uppercased():
    engine = make_executor_session()
    provider = FakeProvider({"AAPL": 150.0})
    with Session(engine) as session:
        result = execute_trade(session, provider, "aapl", "buy", 1)
    assert result["ticker"] == "AAPL"


def test_execute_watchlist_add():
    engine = make_executor_session()
    provider = FakeProvider({})
    with Session(engine) as session:
        result = execute_watchlist_change(session, provider, "PYPL", "add")
    assert result["ok"] is True
    assert result["action"] == "add"
    assert "PYPL" in provider.added


def test_execute_watchlist_add_duplicate_ok():
    engine = make_executor_session()
    provider = FakeProvider({})
    with Session(engine) as session:
        # AAPL already in watchlist from seed
        result = execute_watchlist_change(session, provider, "AAPL", "add")
    assert result["ok"] is True
    assert "note" in result


def test_execute_watchlist_remove():
    engine = make_executor_session()
    provider = FakeProvider({"AAPL": 150.0})
    with Session(engine) as session:
        result = execute_watchlist_change(session, provider, "AAPL", "remove")
    assert result["ok"] is True
    assert "AAPL" in provider.removed


def test_execute_watchlist_remove_nonexistent_ok():
    engine = make_executor_session()
    provider = FakeProvider({})
    with Session(engine) as session:
        result = execute_watchlist_change(session, provider, "FAKE", "remove")
    assert result["ok"] is True
    assert "note" in result


def test_execute_watchlist_invalid_action():
    engine = make_executor_session()
    provider = FakeProvider({})
    with Session(engine) as session:
        result = execute_watchlist_change(session, provider, "AAPL", "toggle")
    assert result["ok"] is False
