from __future__ import annotations

import asyncio
import json
import os
import sys
from types import SimpleNamespace

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

pytest.importorskip("fastapi")
pytest.importorskip("openai")
pytest.importorskip("pydantic")
pytest.importorskip("pydantic_settings")

from routers.interview import _create_completion  # noqa: E402
from core.config import settings  # noqa: E402
from models.schemas import InterviewChatRequest  # noqa: E402


class FakeCompletions:
    def __init__(self, response):
        self._responses = response if isinstance(response, list) else [response]
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        response = self._responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


class FakeClient:
    def __init__(self, response):
        self.chat = SimpleNamespace(completions=FakeCompletions(response))

    def with_options(self, **kwargs):
        _ = kwargs
        return self


def _run(coro):
    return asyncio.run(coro)


def _build_request(message_count: int = 1) -> InterviewChatRequest:
    messages = [
        {"role": "user", "content": f"Message {index}"}
        for index in range(message_count)
    ]
    return InterviewChatRequest(
        systemPrompt="You are a qualitative interviewer.",
        messages=messages,
        tools=[
            {
                "type": "function",
                "function": {
                    "name": "complete_interview",
                    "description": "Complete the interview.",
                    "parameters": {
                        "type": "object",
                        "properties": {"topicsCovered": {"type": "array", "items": {"type": "string"}}},
                        "required": ["topicsCovered"],
                    },
                },
            }
        ],
    )


def test_create_completion_parses_tool_call(monkeypatch):
    settings.openai_api_key = "sk-test"
    response = SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(
                    content=None,
                    tool_calls=[
                        SimpleNamespace(
                            function=SimpleNamespace(
                                name="complete_interview",
                                arguments=json.dumps(
                                    {
                                        "topicsCovered": ["Workload", "Support"],
                                        "coverageNote": "All topics covered.",
                                    }
                                ),
                            )
                        )
                    ],
                )
            )
        ]
    )
    fake_client = FakeClient(response)
    monkeypatch.setattr("routers.interview.get_client", lambda: fake_client)

    result = _run(_create_completion(_build_request()))

    assert result.is_complete is True
    assert result.topics_covered == ["Workload", "Support"]
    assert result.coverage_note == "All topics covered."
    assert result.assistant_message == "Thank you. That's all I need for today."


def test_create_completion_forces_completion_at_limit(monkeypatch):
    settings.openai_api_key = "sk-test"
    response = SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(
                    content="Final check-in",
                    tool_calls=[],
                )
            )
        ]
    )
    fake_client = FakeClient(response)
    monkeypatch.setattr("routers.interview.get_client", lambda: fake_client)

    result = _run(_create_completion(_build_request(message_count=80)))

    assert result.is_complete is True
    assert result.coverage_note == "Conversation reached the 40-turn limit."
    assert result.assistant_message == "Final check-in"


def test_create_completion_falls_back_on_empty_model_response(monkeypatch):
    settings.openai_api_key = "sk-test"
    response = SimpleNamespace(choices=[])
    fake_client = FakeClient(response)
    monkeypatch.setattr("routers.interview.get_client", lambda: fake_client)

    result = _run(
        _create_completion(
            InterviewChatRequest(
                systemPrompt="You are a qualitative interviewer.",
                messages=[
                    {"role": "assistant", "content": "What has helped recently?"},
                    {"role": "user", "content": "Support from my manager."},
                ],
            )
        )
    )

    assert result.is_complete is False
    assert result.assistant_message == "What has helped recently? Could you tell me more?"


def test_create_completion_maps_refusal_to_safe_follow_up(monkeypatch):
    settings.openai_api_key = "sk-test"
    response = SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(
                    content="",
                    refusal="I cannot help with that.",
                    tool_calls=[],
                )
            )
        ]
    )
    fake_client = FakeClient(response)
    monkeypatch.setattr("routers.interview.get_client", lambda: fake_client)

    result = _run(_create_completion(_build_request()))

    assert result.is_complete is False
    assert result.assistant_message == "I'd like to explore that differently. Could you tell me a bit more about that?"


def test_create_completion_retries_connection_once(monkeypatch):
    class FakeAPIConnectionError(Exception):
        pass

    async def no_sleep(*_args):
        return None

    settings.openai_api_key = "sk-test"
    response = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content="Recovered", tool_calls=[]))]
    )
    fake_client = FakeClient([FakeAPIConnectionError("timeout"), response])
    monkeypatch.setattr("routers.interview.APIConnectionError", FakeAPIConnectionError)
    monkeypatch.setattr("routers.interview.get_client", lambda: fake_client)
    monkeypatch.setattr("routers.interview.asyncio.sleep", no_sleep)

    result = _run(_create_completion(_build_request()))

    assert result.assistant_message == "Recovered"
    assert len(fake_client.chat.completions.calls) == 2


def test_create_completion_retries_529_overload(monkeypatch):
    class FakeAPIStatusError(Exception):
        def __init__(self, status_code: int):
            super().__init__("overloaded")
            self.status_code = status_code

    async def no_sleep(*_args):
        return None

    settings.openai_api_key = "sk-test"
    response = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content="Recovered", tool_calls=[]))]
    )
    fake_client = FakeClient([FakeAPIStatusError(529), response])
    monkeypatch.setattr("routers.interview.APIStatusError", FakeAPIStatusError)
    monkeypatch.setattr("routers.interview.get_client", lambda: fake_client)
    monkeypatch.setattr("routers.interview.asyncio.sleep", no_sleep)

    result = _run(_create_completion(_build_request()))

    assert result.assistant_message == "Recovered"
    assert len(fake_client.chat.completions.calls) == 2
