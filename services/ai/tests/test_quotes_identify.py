from __future__ import annotations

import asyncio
import importlib
import json
import os
import sys
from types import ModuleType, SimpleNamespace

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

pytest.importorskip("fastapi")
pytest.importorskip("openai")
pytest.importorskip("pydantic")
pytest.importorskip("pydantic_settings")

from models.schemas import QuoteIdentifyRequest, ThemeRef  # noqa: E402


class FakeCompletions:
    def __init__(self, response):
        self.calls = []
        self._response = response

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return self._response


class FakeClient:
    def __init__(self, response):
        self.chat = SimpleNamespace(completions=FakeCompletions(response))


def _run(coro):
    return asyncio.run(coro)


def _load_quotes_module():
    fake_config = ModuleType("core.config")
    fake_config.settings = SimpleNamespace(
        openai_api_key="sk-test",
        openai_model="gpt-4o-mini",
    )

    sys.modules["core.config"] = fake_config
    sys.modules.pop("routers.quotes", None)
    return importlib.import_module("routers.quotes")


def _mock_completion(payload: dict):
    return SimpleNamespace(
        choices=[
            SimpleNamespace(message=SimpleNamespace(content=json.dumps(payload)))
        ]
    )


def test_identify_quotes_returns_linked_quotes(monkeypatch):
    quotes_module = _load_quotes_module()
    theme_id = "22222222-2222-4222-8222-222222222222"

    fake_client = FakeClient(
        _mock_completion(
            {
                "quotes": [
                    {
                        "text": "We need more recovery time.",
                        "speaker": "Alex",
                        "theme_id": theme_id,
                        "span_start": 0,
                        "span_end": 27,
                    }
                ]
            }
        )
    )
    monkeypatch.setattr(quotes_module, "get_client", lambda: fake_client)

    response = _run(
        quotes_module.identify_quotes(
            QuoteIdentifyRequest(
                transcript="Alex: We need more recovery time.",
                themes=[ThemeRef(id=theme_id, label="Workload pressure")],
            )
        )
    )

    assert len(response.quotes) == 1
    assert response.quotes[0].text == "We need more recovery time."
    assert response.quotes[0].theme_id == theme_id
