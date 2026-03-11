"""OpenRouter LLM client with structured JSON output."""
import json
from dataclasses import dataclass, field

import httpx

from config import LLM_MOCK, OPENROUTER_API_KEY

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "openai/gpt-4o-mini"

_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "message": {"type": "string"},
        "trades": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "ticker": {"type": "string"},
                    "side": {"type": "string", "enum": ["buy", "sell"]},
                    "quantity": {"type": "number"},
                },
                "required": ["ticker", "side", "quantity"],
                "additionalProperties": False,
            },
        },
        "watchlist_changes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "ticker": {"type": "string"},
                    "action": {"type": "string", "enum": ["add", "remove"]},
                },
                "required": ["ticker", "action"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["message", "trades", "watchlist_changes"],
    "additionalProperties": False,
}

SYSTEM_PROMPT = (
    "You are Finance Ally, an AI trading assistant for a simulated portfolio. "
    "Analyze portfolio composition, risk, and P&L. Suggest and execute trades when asked. "
    "Manage the watchlist proactively. Be concise and data-driven. "
    "Always respond with valid JSON matching the required schema."
)

_MOCK_RESPONSE = {
    "message": "I can help you analyze your portfolio.",
    "trades": [],
    "watchlist_changes": [],
}


@dataclass
class LLMResponse:
    message: str
    trades: list[dict] = field(default_factory=list)
    watchlist_changes: list[dict] = field(default_factory=list)


def call_llm(history: list[dict], portfolio_context: str) -> LLMResponse:
    """Call OpenRouter LLM (or return mock) and return parsed structured response."""
    if LLM_MOCK:
        return LLMResponse(**_MOCK_RESPONSE)

    system_message = {
        "role": "system",
        "content": f"{SYSTEM_PROMPT}\n\nCurrent Portfolio:\n{portfolio_context}",
    }
    messages = [system_message] + history

    payload = {
        "model": MODEL,
        "messages": messages,
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "ChatResponse",
                "strict": True,
                "schema": _RESPONSE_SCHEMA,
            },
        },
    }

    # Synchronous httpx call (30s timeout). Acceptable for single-user; revisit if concurrency is needed.
    try:
        response = httpx.post(
            OPENROUTER_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise ValueError(f"OpenRouter HTTP {exc.response.status_code}") from exc

    try:
        content = response.json()["choices"][0]["message"]["content"]
        data = json.loads(content)
        return LLMResponse(
            message=data["message"],
            trades=data.get("trades", []),
            watchlist_changes=data.get("watchlist_changes", []),
        )
    except (KeyError, json.JSONDecodeError, IndexError) as exc:
        raise ValueError(f"Malformed LLM response: {exc}") from exc
