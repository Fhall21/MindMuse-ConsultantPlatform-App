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

from models.schemas import EmailDraftRequest  # noqa: E402


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


def _load_draft_module():
    fake_config = ModuleType("core.config")
    fake_config.settings = SimpleNamespace(
        openai_api_key="sk-test",
        openai_model="gpt-4o-mini",
    )

    sys.modules["core.config"] = fake_config
    sys.modules.pop("routers.draft", None)
    return importlib.import_module("routers.draft")


def _mock_completion(payload: dict[str, str]):
    return SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(content=json.dumps(payload))
            )
        ]
    )


def test_draft_email_includes_personalization_and_saved_guidance(monkeypatch):
    draft_module = _load_draft_module()

    fake_client = FakeClient(
        _mock_completion(
            {
                "subject": "Consultation follow-up for Alex",
                "body": "Hello Alex\n\n• Workload\n– Reviewed workload pressure.\n\nKind regards,",
            }
        )
    )
    monkeypatch.setattr(draft_module, "get_client", lambda: fake_client)

    response = _run(
        draft_module.draft_email(
            EmailDraftRequest(
                transcript="Alex described workload pressure and agreed next steps.",
                themes=["Workload pressure"],
                people=["Alex"],
                consultation_title="Return to work check-in",
                consultation_date="2026-04-30",
                learning_signals=[
                    {
                        "label": "Return to work barriers",
                        "decision_type": "accept",
                        "rationale": None,
                        "weight": 1.0,
                    }
                ],
                user_preferences={
                    "consultation_types": ["return to work assessment"],
                    "focus_areas": ["workload"],
                    "excluded_topics": ["small talk"],
                    "email_guidance": "Keep the draft concise and action-led.",
                },
                ai_learnings=[
                    {
                        "id": "learning-1",
                        "user_id": "user-1",
                        "topic_type": "theme_generation",
                        "learning_type": "trend",
                        "label": "Return to work barriers",
                        "description": "Often useful when employer friction appears.",
                        "supporting_metrics": {"accepted_count": 3, "percentage": 0.75},
                        "created_at": "2026-04-30T10:00:00Z",
                        "expires_at": None,
                        "version": 1,
                    }
                ],
            )
        )
    )

    assert response.subject == "Consultation follow-up for Alex"
    call = fake_client.chat.completions.calls[0]
    system_prompt = call["messages"][0]["content"]
    assert "Saved user preferences" in system_prompt
    assert '"workload"' in system_prompt
    assert "Saved email drafting guidance" in system_prompt
    assert "Keep the draft concise and action-led." in system_prompt


def test_draft_email_omits_saved_guidance_section_when_empty(monkeypatch):
    draft_module = _load_draft_module()

    fake_client = FakeClient(
        _mock_completion(
            {
                "subject": "Subject",
                "body": "Body",
            }
        )
    )
    monkeypatch.setattr(draft_module, "get_client", lambda: fake_client)

    _run(
        draft_module.draft_email(
            EmailDraftRequest(
                transcript="Transcript",
                themes=["Theme"],
                people=["Alex"],
                user_preferences={
                    "consultation_types": [],
                    "focus_areas": [],
                    "excluded_topics": [],
                    "email_guidance": "   ",
                },
            )
        )
    )

    call = fake_client.chat.completions.calls[0]
    system_prompt = call["messages"][0]["content"]
    assert "Saved email drafting guidance" not in system_prompt