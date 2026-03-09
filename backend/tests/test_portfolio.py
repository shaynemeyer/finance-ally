import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, StaticPool, create_engine, select

from database import get_session
from models import Position, PortfolioSnapshot, Trade, UserProfile
from models.seed import seed_data
from routes.portfolio import router
from tasks import take_snapshot


# ---------------------------------------------------------------------------
# Test infrastructure
# ---------------------------------------------------------------------------

class FakePrice:
    def __init__(self, price: float):
        self.price = price


class FakeProvider:
    def __init__(self, prices: dict[str, float] | None = None):
        self._prices = prices or {}

    def get_price(self, ticker: str):
        if ticker in self._prices:
            return FakePrice(self._prices[ticker])
        return None


def make_app(prices: dict[str, float] | None = None):
    mem_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(mem_engine)
    with Session(mem_engine) as s:
        seed_data(s)

    app = FastAPI()
    app.include_router(router)
    app.state.market_provider = FakeProvider(prices or {})
    app.state.engine = mem_engine

    def override_session():
        with Session(mem_engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    return app, mem_engine


@pytest.fixture
def client():
    app, _ = make_app({"AAPL": 150.0, "TSLA": 200.0})
    with TestClient(app) as c:
        yield c


@pytest.fixture
def client_and_engine():
    app, mem_engine = make_app({"AAPL": 150.0, "TSLA": 200.0})
    with TestClient(app) as c:
        yield c, mem_engine


# ---------------------------------------------------------------------------
# GET /api/portfolio
# ---------------------------------------------------------------------------

def test_get_portfolio_empty_positions(client):
    response = client.get("/api/portfolio")
    assert response.status_code == 200
    data = response.json()
    assert data["cash_balance"] == 10000.0
    assert data["total_value"] == 10000.0
    assert data["positions"] == []


def test_get_portfolio_with_position(client_and_engine):
    client, mem_engine = client_and_engine
    with Session(mem_engine) as session:
        session.add(Position(user_id="default", ticker="AAPL", quantity=10, avg_cost=140.0))
        session.commit()

    response = client.get("/api/portfolio")
    assert response.status_code == 200
    data = response.json()

    # cash unchanged, position at 150 each
    assert data["cash_balance"] == 10000.0
    assert data["total_value"] == pytest.approx(10000.0 + 10 * 150.0)
    pos = data["positions"][0]
    assert pos["ticker"] == "AAPL"
    assert pos["quantity"] == 10
    assert pos["avg_cost"] == 140.0
    assert pos["current_price"] == 150.0
    assert pos["unrealized_pnl"] == pytest.approx(10 * 10.0)  # (150 - 140) * 10
    assert pos["unrealized_pnl_pct"] == pytest.approx(10 / 140 * 100)


# ---------------------------------------------------------------------------
# POST /api/portfolio/trade — buy
# ---------------------------------------------------------------------------

def test_buy_creates_position(client_and_engine):
    client, mem_engine = client_and_engine
    response = client.post("/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 5})
    assert response.status_code == 201
    data = response.json()
    assert data["ticker"] == "AAPL"
    assert data["side"] == "buy"
    assert data["quantity"] == 5
    assert data["price"] == 150.0
    assert data["total"] == pytest.approx(750.0)

    with Session(mem_engine) as session:
        pos = session.exec(select(Position).where(Position.ticker == "AAPL")).first()
        assert pos.quantity == 5
        assert pos.avg_cost == 150.0

        user = session.get(UserProfile, "default")
        assert user.cash_balance == pytest.approx(10000.0 - 750.0)


def test_buy_updates_avg_cost(client_and_engine):
    client, mem_engine = client_and_engine
    with Session(mem_engine) as session:
        session.add(Position(user_id="default", ticker="AAPL", quantity=10, avg_cost=100.0))
        session.commit()

    client.post("/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 10})

    with Session(mem_engine) as session:
        pos = session.exec(select(Position).where(Position.ticker == "AAPL")).first()
        # (10*100 + 10*150) / 20 = 125
        assert pos.quantity == 20
        assert pos.avg_cost == pytest.approx(125.0)


def test_buy_insufficient_cash_returns_400(client):
    response = client.post("/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 10000})
    assert response.status_code == 400
    assert "Insufficient cash" in response.json()["detail"]


def test_buy_no_price_data_returns_404(client):
    response = client.post("/api/portfolio/trade", json={"ticker": "FAKE", "side": "buy", "quantity": 1})
    assert response.status_code == 404


def test_buy_zero_quantity_returns_400(client):
    response = client.post("/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 0})
    assert response.status_code == 400


def test_buy_invalid_side_returns_400(client):
    response = client.post("/api/portfolio/trade", json={"ticker": "AAPL", "side": "hold", "quantity": 1})
    assert response.status_code == 400


def test_buy_ticker_uppercased(client_and_engine):
    client, mem_engine = client_and_engine
    response = client.post("/api/portfolio/trade", json={"ticker": "aapl", "side": "buy", "quantity": 1})
    assert response.status_code == 201
    assert response.json()["ticker"] == "AAPL"


def test_buy_logs_trade(client_and_engine):
    client, mem_engine = client_and_engine
    client.post("/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 3})
    with Session(mem_engine) as session:
        trades = session.exec(select(Trade).where(Trade.ticker == "AAPL")).all()
        assert len(trades) == 1
        assert trades[0].side == "buy"
        assert trades[0].quantity == 3
        assert trades[0].price == 150.0


# ---------------------------------------------------------------------------
# POST /api/portfolio/trade — sell
# ---------------------------------------------------------------------------

def test_sell_reduces_position(client_and_engine):
    client, mem_engine = client_and_engine
    with Session(mem_engine) as session:
        session.add(Position(user_id="default", ticker="AAPL", quantity=10, avg_cost=140.0))
        session.commit()

    response = client.post("/api/portfolio/trade", json={"ticker": "AAPL", "side": "sell", "quantity": 4})
    assert response.status_code == 201

    with Session(mem_engine) as session:
        pos = session.exec(select(Position).where(Position.ticker == "AAPL")).first()
        assert pos.quantity == 6
        user = session.get(UserProfile, "default")
        assert user.cash_balance == pytest.approx(10000.0 + 4 * 150.0)


def test_sell_entire_position_removes_row(client_and_engine):
    client, mem_engine = client_and_engine
    with Session(mem_engine) as session:
        session.add(Position(user_id="default", ticker="AAPL", quantity=5, avg_cost=140.0))
        session.commit()

    client.post("/api/portfolio/trade", json={"ticker": "AAPL", "side": "sell", "quantity": 5})

    with Session(mem_engine) as session:
        pos = session.exec(select(Position).where(Position.ticker == "AAPL")).first()
        assert pos is None


def test_sell_insufficient_shares_returns_400(client_and_engine):
    client, mem_engine = client_and_engine
    with Session(mem_engine) as session:
        session.add(Position(user_id="default", ticker="AAPL", quantity=2, avg_cost=140.0))
        session.commit()

    response = client.post("/api/portfolio/trade", json={"ticker": "AAPL", "side": "sell", "quantity": 5})
    assert response.status_code == 400
    assert "Insufficient shares" in response.json()["detail"]


def test_sell_no_position_returns_400(client):
    response = client.post("/api/portfolio/trade", json={"ticker": "AAPL", "side": "sell", "quantity": 1})
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# GET /api/portfolio/history
# ---------------------------------------------------------------------------

def test_portfolio_history_empty(client):
    response = client.get("/api/portfolio/history")
    assert response.status_code == 200
    assert response.json() == []


def test_portfolio_history_returns_snapshots(client_and_engine):
    client, mem_engine = client_and_engine
    with Session(mem_engine) as session:
        session.add(PortfolioSnapshot(user_id="default", total_value=10500.0))
        session.add(PortfolioSnapshot(user_id="default", total_value=10750.0))
        session.commit()

    response = client.get("/api/portfolio/history")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["total_value"] == 10500.0
    assert data[1]["total_value"] == 10750.0
    assert "recorded_at" in data[0]


# ---------------------------------------------------------------------------
# take_snapshot utility
# ---------------------------------------------------------------------------

def test_take_snapshot_records_value():
    mem_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(mem_engine)
    with Session(mem_engine) as s:
        seed_data(s)
        s.add(Position(user_id="default", ticker="AAPL", quantity=10, avg_cost=140.0))
        s.commit()

    provider = FakeProvider({"AAPL": 150.0})
    take_snapshot(provider, mem_engine)

    with Session(mem_engine) as session:
        snapshots = session.exec(select(PortfolioSnapshot)).all()
        assert len(snapshots) == 1
        # 10000 cash + 10 * 150 = 11500
        assert snapshots[0].total_value == pytest.approx(11500.0)


def test_take_snapshot_uses_avg_cost_when_no_price():
    mem_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(mem_engine)
    with Session(mem_engine) as s:
        seed_data(s)
        s.add(Position(user_id="default", ticker="UNKNOWN", quantity=5, avg_cost=100.0))
        s.commit()

    provider = FakeProvider({})  # no prices
    take_snapshot(provider, mem_engine)

    with Session(mem_engine) as session:
        snapshots = session.exec(select(PortfolioSnapshot)).all()
        assert snapshots[0].total_value == pytest.approx(10000.0 + 5 * 100.0)
