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
        self._response = response
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return self._response


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