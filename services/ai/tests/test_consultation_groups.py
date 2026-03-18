"""
Tests for the consultation group AI endpoints.

Tests verify:
  1. Prompt construction: correct fields included in user content
  2. JSON-mode response parsing: valid model output → structured response
  3. Schema mismatch: malformed model output → 422
  4. Timeout: 30s timeout parameter is passed to the OpenAI client
  5. Missing API key: 503 returned
  6. generate-group-summary: happy path + malformed response
"""

import json
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# Add services/ai to path for imports
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app

client = TestClient(app)


# ─── Fixtures ─────────────────────────────────────────────────────────────────

SUGGEST_PAYLOAD = {
    "round_label": "March Cohort",
    "selected_theme_labels": ["Workplace stress", "Return-to-work barriers"],
    "consultations": [
        {
            "consultation_id": "c1",
            "consultation_title": "Session A",
            "theme_labels": ["Workplace stress", "Burnout"],
            "theme_descriptions": ["High workload", "Emotional exhaustion"],
        },
        {
            "consultation_id": "c2",
            "consultation_title": "Session B",
            "theme_labels": ["Return-to-work barriers", "Workplace stress"],
            "theme_descriptions": ["Fear of judgment", ""],
        },
        {
            "consultation_id": "c3",
            "consultation_title": "Session C",
            "theme_labels": ["Family support needs"],
            "theme_descriptions": ["Carer responsibilities"],
        },
    ],
}

SUGGEST_MODEL_RESPONSE = {
    "groups": [
        {
            "label": "Workplace Stress Cluster",
            "consultation_ids": ["c1", "c2"],
            "explanation": "Both sessions share workplace stress and have return-to-work barriers.",
        }
    ]
}

SUMMARY_PAYLOAD = {
    "round_label": "March Cohort",
    "group_label": "Workplace Stress Cluster",
    "consultations": [
        {
            "consultation_id": "c1",
            "consultation_title": "Session A",
            "theme_labels": ["Workplace stress", "Burnout"],
            "theme_descriptions": ["High workload", "Emotional exhaustion"],
        },
        {
            "consultation_id": "c2",
            "consultation_title": "Session B",
            "theme_labels": ["Return-to-work barriers"],
            "theme_descriptions": ["Fear of judgment"],
        },
    ],
}

SUMMARY_MODEL_RESPONSE = {
    "title": "Workplace Stress Cluster",
    "content": "Two consultations share a pattern of workplace stress and return-to-work challenges.",
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _mock_openai_response(payload: dict):
    """Return a mock OpenAI completion whose message content is payload as JSON."""
    mock_message = MagicMock()
    mock_message.content = json.dumps(payload)
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_completion = MagicMock()
    mock_completion.choices = [mock_choice]
    return mock_completion


# ─── suggest-consultation-groups ──────────────────────────────────────────────


def test_suggest_consultation_groups_happy_path():
    """Valid request → suggestions returned with correct shape."""
    mock_completion = _mock_openai_response(SUGGEST_MODEL_RESPONSE)

    with patch("routers.rounds.get_client") as mock_get_client, \
         patch("routers.rounds.settings") as mock_settings:
        mock_settings.openai_api_key = "sk-test"
        mock_settings.openai_model = "gpt-4o-mini"
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_completion
        mock_get_client.return_value = mock_client

        resp = client.post("/rounds/suggest-consultation-groups", json=SUGGEST_PAYLOAD)

    assert resp.status_code == 200
    data = resp.json()
    assert "groups" in data
    assert len(data["groups"]) == 1
    group = data["groups"][0]
    assert group["label"] == "Workplace Stress Cluster"
    assert set(group["consultation_ids"]) == {"c1", "c2"}
    assert "explanation" in group


def test_suggest_consultation_groups_timeout_passed():
    """The OpenAI create() call must include timeout=30.0."""
    mock_completion = _mock_openai_response(SUGGEST_MODEL_RESPONSE)

    with patch("routers.rounds.get_client") as mock_get_client, \
         patch("routers.rounds.settings") as mock_settings:
        mock_settings.openai_api_key = "sk-test"
        mock_settings.openai_model = "gpt-4o-mini"
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_completion
        mock_get_client.return_value = mock_client

        client.post("/rounds/suggest-consultation-groups", json=SUGGEST_PAYLOAD)

        call_kwargs = mock_client.chat.completions.create.call_args[1]
        assert call_kwargs.get("timeout") == 30.0, "timeout=30.0 must be passed to OpenAI"


def test_suggest_consultation_groups_prompt_includes_themes():
    """User content must include the selected theme labels and consultation titles."""
    mock_completion = _mock_openai_response(SUGGEST_MODEL_RESPONSE)

    with patch("routers.rounds.get_client") as mock_get_client, \
         patch("routers.rounds.settings") as mock_settings:
        mock_settings.openai_api_key = "sk-test"
        mock_settings.openai_model = "gpt-4o-mini"
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_completion
        mock_get_client.return_value = mock_client

        client.post("/rounds/suggest-consultation-groups", json=SUGGEST_PAYLOAD)

        messages = mock_client.chat.completions.create.call_args[1]["messages"]
        user_content = next(m["content"] for m in messages if m["role"] == "user")

        assert "Workplace stress" in user_content
        assert "Return-to-work barriers" in user_content
        assert "Session A" in user_content
        assert "March Cohort" in user_content


def test_suggest_consultation_groups_malformed_model_output():
    """Model returns JSON that doesn't match the schema → 422."""
    bad_response = {"wrong_key": "bad"}
    mock_completion = _mock_openai_response(bad_response)

    with patch("routers.rounds.get_client") as mock_get_client, \
         patch("routers.rounds.settings") as mock_settings:
        mock_settings.openai_api_key = "sk-test"
        mock_settings.openai_model = "gpt-4o-mini"
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_completion
        mock_get_client.return_value = mock_client

        resp = client.post("/rounds/suggest-consultation-groups", json=SUGGEST_PAYLOAD)

    assert resp.status_code == 422


def test_suggest_consultation_groups_missing_api_key():
    """No OpenAI API key → 503."""
    with patch("routers.rounds.settings") as mock_settings:
        mock_settings.openai_api_key = None

        resp = client.post("/rounds/suggest-consultation-groups", json=SUGGEST_PAYLOAD)

    assert resp.status_code == 503


# ─── generate-group-summary ───────────────────────────────────────────────────


def test_generate_group_summary_happy_path():
    """Valid request → summary returned with title and content."""
    mock_completion = _mock_openai_response(SUMMARY_MODEL_RESPONSE)

    with patch("routers.rounds.get_client") as mock_get_client, \
         patch("routers.rounds.settings") as mock_settings:
        mock_settings.openai_api_key = "sk-test"
        mock_settings.openai_model = "gpt-4o-mini"
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_completion
        mock_get_client.return_value = mock_client

        resp = client.post("/rounds/generate-group-summary", json=SUMMARY_PAYLOAD)

    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Workplace Stress Cluster"
    assert "workplace stress" in data["content"].lower()


def test_generate_group_summary_timeout_passed():
    """The OpenAI create() call must include timeout=30.0."""
    mock_completion = _mock_openai_response(SUMMARY_MODEL_RESPONSE)

    with patch("routers.rounds.get_client") as mock_get_client, \
         patch("routers.rounds.settings") as mock_settings:
        mock_settings.openai_api_key = "sk-test"
        mock_settings.openai_model = "gpt-4o-mini"
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_completion
        mock_get_client.return_value = mock_client

        client.post("/rounds/generate-group-summary", json=SUMMARY_PAYLOAD)

        call_kwargs = mock_client.chat.completions.create.call_args[1]
        assert call_kwargs.get("timeout") == 30.0


def test_generate_group_summary_malformed_model_output():
    """Model returns JSON that doesn't match schema → 422."""
    mock_completion = _mock_openai_response({"unexpected": "data"})

    with patch("routers.rounds.get_client") as mock_get_client, \
         patch("routers.rounds.settings") as mock_settings:
        mock_settings.openai_api_key = "sk-test"
        mock_settings.openai_model = "gpt-4o-mini"
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_completion
        mock_get_client.return_value = mock_client

        resp = client.post("/rounds/generate-group-summary", json=SUMMARY_PAYLOAD)

    assert resp.status_code == 422
