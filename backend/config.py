import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

_db_file = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "db", "finance-ally.db")
)
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{_db_file}")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "")
MASSIVE_API_KEY = os.getenv("MASSIVE_API_KEY", "")
MASSIVE_POLL_INTERVAL = float(os.getenv("MASSIVE_POLL_INTERVAL", "15.0"))
LLM_MOCK = os.getenv("LLM_MOCK", "false").lower() == "true"
