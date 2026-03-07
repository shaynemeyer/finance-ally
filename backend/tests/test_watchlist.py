import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI
from sqlmodel import SQLModel, Session, create_engine, StaticPool

from database import get_session
from models import Watchlist
from models.seed import seed_data
from routes.watchlist import router


def make_app():
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

    class FakeProvider:
        def __init__(self):
            self.added = []
            self.removed = []

        def add_ticker(self, ticker):
            self.added.append(ticker)

        def remove_ticker(self, ticker):
            self.removed.append(ticker)

        def get_price(self, ticker):
            return None

    provider = FakeProvider()
    app.state.market_provider = provider

    def override_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    return app, provider


@pytest.fixture
def client_and_provider():
    app, provider = make_app()
    with TestClient(app) as client:
        yield client, provider


def test_get_watchlist_returns_default_tickers(client_and_provider):
    client, _ = client_and_provider
    response = client.get("/api/watchlist")
    assert response.status_code == 200
    tickers = [item["ticker"] for item in response.json()]
    assert "AAPL" in tickers
    assert len(tickers) == 10


def test_add_ticker(client_and_provider):
    client, provider = client_and_provider
    response = client.post("/api/watchlist", json={"ticker": "PYPL"})
    assert response.status_code == 201
    assert response.json()["ticker"] == "PYPL"
    assert "PYPL" in provider.added


def test_add_ticker_uppercases(client_and_provider):
    client, provider = client_and_provider
    response = client.post("/api/watchlist", json={"ticker": "pypl"})
    assert response.status_code == 201
    assert response.json()["ticker"] == "PYPL"


def test_add_duplicate_ticker_returns_409(client_and_provider):
    client, _ = client_and_provider
    response = client.post("/api/watchlist", json={"ticker": "AAPL"})
    assert response.status_code == 409


def test_remove_ticker(client_and_provider):
    client, provider = client_and_provider
    response = client.delete("/api/watchlist/AAPL")
    assert response.status_code == 200
    assert response.json()["ticker"] == "AAPL"
    assert "AAPL" in provider.removed


def test_remove_ticker_case_insensitive(client_and_provider):
    client, provider = client_and_provider
    response = client.delete("/api/watchlist/aapl")
    assert response.status_code == 200
    assert "AAPL" in provider.removed


def test_remove_nonexistent_ticker_returns_404(client_and_provider):
    client, _ = client_and_provider
    response = client.delete("/api/watchlist/FAKE")
    assert response.status_code == 404


def test_watchlist_reflects_add_and_remove(client_and_provider):
    client, _ = client_and_provider
    client.post("/api/watchlist", json={"ticker": "SPOT"})
    response = client.get("/api/watchlist")
    tickers = [item["ticker"] for item in response.json()]
    assert "SPOT" in tickers

    client.delete("/api/watchlist/SPOT")
    response = client.get("/api/watchlist")
    tickers = [item["ticker"] for item in response.json()]
    assert "SPOT" not in tickers
