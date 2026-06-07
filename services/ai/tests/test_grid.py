from __future__ import annotations

import json
import os
import sys
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

pytest.importorskip("openai")
pytest.importorskip("pydantic_settings")

from core.chat_service_token import create_chat_service_token  # noqa: E402
from middleware.chat_service_token import ChatServiceTokenMiddleware  # noqa: E402
from routers import grid  # noqa: E402


SECRET = "test-secret-at-least-thirty-two-characters-long"


class FakeCompletions:
    def __init__(self, content: str):
        self.calls: list[dict] = []
        self.content = content

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(content=self.content)
                )
            ]
        )


class FakeClient:
    def __init__(self, content: str):
        self.chat = SimpleNamespace(completions=FakeCompletions(content))


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(
        "middleware.chat_service_token.settings",
        SimpleNamespace(better_auth_secret=SECRET),
    )
    monkeypatch.setattr(
        grid,
        "settings",
        SimpleNamespace(
            openai_api_key="sk-test",
            openai_model="gpt-4o-mini",
        ),
    )

    app = FastAPI()
    app.add_middleware(ChatServiceTokenMiddleware)
    app.include_router(grid.router)
    return TestClient(app)


def _auth_headers() -> dict[str, str]:
    token = create_chat_service_token("user-1", "session-1", SECRET)
    return {"Authorization": f"Bearer {token}"}


def _request_payload(transcript: str) -> dict:
    return {
        "meetingId": "meeting-1",
        "transcriptRaw": transcript,
        "columnQuestions": [
            {
                "columnId": "column-1",
                "question": "What barrier affected the return to work?",
                "cellId": "cell-1",
            },
            {
                "columnId": "column-2",
                "question": "What support did the participant request?",
                "cellId": "cell-2",
            },
        ],
    }


def test_generate_grid_returns_answers_for_all_questions(client, monkeypatch):
    transcript = (
        "Interviewer: What has made returning difficult?\n"
        "Alex: The rotating shifts make my sleep unpredictable.\n\n"
        "Interviewer: What would help?\n"
        "Alex: I need a fixed start time and weekly check-ins.\n\n"
        "Interviewer: Is anything else relevant?\n"
        "Alex: No, those are the main issues."
    )
    barrier_quote = "The rotating shifts make my sleep unpredictable."
    support_quote = "I need a fixed start time and weekly check-ins."
    response_payload = {
        "answers": [
            {
                "columnId": "column-1",
                "cellId": "cell-1",
                "insights": [
                    {
                        "text": "Rotating shifts disrupt sleep and obstruct a stable return.",
                        "existingInsightId": None,
                        "quotes": [
                            {
                                "exactText": barrier_quote,
                                "spanStart": transcript.index(barrier_quote),
                                "spanEnd": transcript.index(barrier_quote)
                                + len(barrier_quote),
                                "relevanceStrength": "strong_match",
                            }
                        ],
                    }
                ],
                "confidence": "high",
                "hasEvidence": True,
            },
            {
                "columnId": "column-2",
                "cellId": "cell-2",
                "insights": [
                    {
                        "text": "Alex requested predictable hours and regular support.",
                        "existingInsightId": None,
                        "quotes": [
                            {
                                "exactText": support_quote,
                                "spanStart": transcript.index(support_quote),
                                "spanEnd": transcript.index(support_quote)
                                + len(support_quote),
                                "relevanceStrength": "strong_match",
                            }
                        ],
                    }
                ],
                "confidence": "high",
                "hasEvidence": True,
            },
        ]
    }
    fake_client = FakeClient(json.dumps(response_payload))
    monkeypatch.setattr(grid, "get_client", lambda: fake_client)

    response = client.post(
        "/grid/generate",
        json=_request_payload(transcript),
        headers=_auth_headers(),
    )

    assert response.status_code == 200
    body = response.json()
    assert [answer["columnId"] for answer in body["answers"]] == [
        "column-1",
        "column-2",
    ]
    assert all(answer["hasEvidence"] for answer in body["answers"])
    assert all(
        insight["quotes"]
        for answer in body["answers"]
        for insight in answer["insights"]
    )
    call = fake_client.chat.completions.calls[0]
    assert call["temperature"] == 0.2
    assert len(call["messages"]) == 2


def test_generate_grid_empty_transcript_returns_no_evidence(client, monkeypatch):
    def fail_if_called():
        raise AssertionError("LLM must not be called for an empty transcript")

    monkeypatch.setattr(grid, "get_client", fail_if_called)

    response = client.post(
        "/grid/generate",
        json=_request_payload("   "),
        headers=_auth_headers(),
    )

    assert response.status_code == 200
    assert response.json()["answers"] == [
        {
            "columnId": "column-1",
            "cellId": "cell-1",
            "insights": [],
            "confidence": None,
            "hasEvidence": False,
        },
        {
            "columnId": "column-2",
            "cellId": "cell-2",
            "insights": [],
            "confidence": None,
            "hasEvidence": False,
        },
    ]


def test_generate_grid_malformed_output_returns_structured_500(
    client,
    monkeypatch,
):
    monkeypatch.setattr(grid, "get_client", lambda: FakeClient("not-json"))

    response = client.post(
        "/grid/generate",
        json=_request_payload("Alex described a workplace barrier."),
        headers=_auth_headers(),
    )

    assert response.status_code == 500
    assert response.json() == {
        "detail": {
            "code": "grid_generation_failed",
            "message": "AI model returned malformed output",
        }
    }


def test_generate_grid_model_timeout_returns_structured_500(
    client,
    monkeypatch,
):
    class TimeoutCompletions:
        def create(self, **kwargs):  # noqa: ARG002
            raise TimeoutError("simulated timeout")

    timeout_client = SimpleNamespace(
        chat=SimpleNamespace(completions=TimeoutCompletions())
    )
    monkeypatch.setattr(grid, "get_client", lambda: timeout_client)

    response = client.post(
        "/grid/generate",
        json=_request_payload("Alex described a workplace barrier."),
        headers=_auth_headers(),
    )

    assert response.status_code == 500
    assert response.json() == {
        "detail": {
            "code": "grid_generation_failed",
            "message": "AI model request failed",
        }
    }


def test_generate_grid_empty_question_list_skips_model(client, monkeypatch):
    def fail_if_called():
        raise AssertionError("LLM must not be called without questions")

    monkeypatch.setattr(grid, "get_client", fail_if_called)
    payload = _request_payload("Alex described a workplace barrier.")
    payload["columnQuestions"] = []

    response = client.post(
        "/grid/generate",
        json=payload,
        headers=_auth_headers(),
    )

    assert response.status_code == 200
    assert response.json() == {"answers": []}


def test_generate_grid_discards_insights_without_verbatim_quotes(
    client,
    monkeypatch,
):
    payload = {
        "answers": [
            {
                "columnId": "column-1",
                "cellId": "cell-1",
                "insights": [
                    {
                        "text": "Unsupported claim.",
                        "existingInsightId": "insight-from-model",
                        "quotes": [
                            {
                                "exactText": "This quote was fabricated.",
                                "spanStart": 0,
                                "spanEnd": 26,
                                "relevanceStrength": "strong_match",
                            }
                        ],
                    }
                ],
                "confidence": "high",
                "hasEvidence": True,
            },
            {
                "columnId": "column-2",
                "cellId": "cell-2",
                "insights": [],
                "confidence": None,
                "hasEvidence": False,
            },
        ]
    }
    monkeypatch.setattr(
        grid,
        "get_client",
        lambda: FakeClient(json.dumps(payload)),
    )

    response = client.post(
        "/grid/generate",
        json=_request_payload("Alex described a workplace barrier."),
        headers=_auth_headers(),
    )

    assert response.status_code == 200
    first_answer = response.json()["answers"][0]
    assert first_answer == {
        "columnId": "column-1",
        "cellId": "cell-1",
        "insights": [],
        "confidence": None,
        "hasEvidence": False,
    }


def test_generate_grid_requires_authentication(client):
    response = client.post(
        "/grid/generate",
        json=_request_payload("Alex described a workplace barrier."),
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Unauthorized"}


def test_column_suggestions_returns_trimmed_maximum_of_five(
    client,
    monkeypatch,
):
    fake_client = FakeClient(
        json.dumps(
            {
                "suggestions": [
                    "  What changed?  ",
                    "",
                    "What barriers emerged?",
                    "What support was requested?",
                    "What worked well?",
                    "What remains unresolved?",
                    "This sixth valid question is dropped",
                ]
            }
        )
    )
    monkeypatch.setattr(grid, "get_client", lambda: fake_client)

    response = client.post(
        "/grid/column-suggestions",
        json={"transcripts": ["Participant described several changes."]},
        headers=_auth_headers(),
    )

    assert response.status_code == 200
    assert response.json() == {
        "suggestions": [
            "What changed?",
            "What barriers emerged?",
            "What support was requested?",
            "What worked well?",
            "What remains unresolved?",
        ]
    }


def test_column_suggestions_empty_transcripts_skip_model(client, monkeypatch):
    def fail_if_called():
        raise AssertionError("LLM must not be called without transcript text")

    monkeypatch.setattr(grid, "get_client", fail_if_called)

    response = client.post(
        "/grid/column-suggestions",
        json={"transcripts": ["", "   "]},
        headers=_auth_headers(),
    )

    assert response.status_code == 200
    assert response.json() == {"suggestions": []}


def test_column_suggestions_malformed_output_returns_structured_500(
    client,
    monkeypatch,
):
    monkeypatch.setattr(grid, "get_client", lambda: FakeClient("not-json"))

    response = client.post(
        "/grid/column-suggestions",
        json={"transcripts": ["Transcript"]},
        headers=_auth_headers(),
    )

    assert response.status_code == 500
    assert response.json()["detail"]["message"] == (
        "AI model returned malformed output"
    )


def test_column_suggestions_rejects_non_list_payload(client, monkeypatch):
    monkeypatch.setattr(
        grid,
        "get_client",
        lambda: FakeClient(json.dumps({"suggestions": "not-a-list"})),
    )

    response = client.post(
        "/grid/column-suggestions",
        json={"transcripts": ["Transcript"]},
        headers=_auth_headers(),
    )

    assert response.status_code == 500
    assert response.json()["detail"]["message"] == (
        "AI model returned malformed output"
    )


def test_column_suggestions_model_failure_returns_structured_500(
    client,
    monkeypatch,
):
    class FailingCompletions:
        def create(self, **kwargs):  # noqa: ARG002
            raise RuntimeError("model unavailable")

    monkeypatch.setattr(
        grid,
        "get_client",
        lambda: SimpleNamespace(
            chat=SimpleNamespace(completions=FailingCompletions())
        ),
    )

    response = client.post(
        "/grid/column-suggestions",
        json={"transcripts": ["Transcript"]},
        headers=_auth_headers(),
    )

    assert response.status_code == 500
    assert response.json()["detail"]["message"] == "AI model request failed"


def test_column_suggestions_requires_authentication(client):
    response = client.post(
        "/grid/column-suggestions",
        json={"transcripts": ["Transcript"]},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Unauthorized"}
