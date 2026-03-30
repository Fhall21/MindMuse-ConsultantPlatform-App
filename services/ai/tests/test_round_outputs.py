"""Tests for round output generation endpoints."""

import json
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app

client = TestClient(app)

REPORT_PAYLOAD = {
    "round_label": "March Cohort",
    "round_description": "Round covering staff wellbeing themes.",
    "consultations": ["Session A", "Session B"],
    "report_outline": {
        "sections": [
            {
                "heading": "Executive Summary",
                "purpose": "Summarise the round clearly.",
                "prose_guidance": "Keep it concise.",
                "depth": "brief",
                "section_note": None,
            },
            {
                "heading": "Priority Risks",
                "purpose": "Focus on material psychosocial risks.",
                "prose_guidance": "Use direct evidence.",
                "depth": "detailed",
                "section_note": "Prefer risk framing over generic theme labels.",
            },
        ]
    },
    "accepted_round_themes": [
        {
            "label": "Workload pressure",
            "description": "Sustained workload strain across teams.",
            "source_kind": "round_theme",
            "consultation_title": None,
            "grouped_under": "Operations pressure",
            "is_user_added": False,
        }
    ],
    "supporting_consultation_themes": [
        {
            "label": "Meeting overload",
            "description": "Back-to-back meetings reduce recovery time.",
            "source_kind": "consultation_theme",
            "consultation_title": "Session A",
            "grouped_under": None,
            "is_user_added": False,
        }
    ],
}


def _mock_openai_response(payload: dict):
    mock_message = MagicMock()
    mock_message.content = json.dumps(payload)
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_completion = MagicMock()
    mock_completion.choices = [mock_choice]
    return mock_completion


def test_generate_round_report_renders_structured_document_to_markdown():
    mock_completion = _mock_openai_response(
        {
            "title": "March Cohort round report",
            "report_document": {
                "sections": [
                    {
                        "heading": "Executive Summary",
                        "paragraphs": ["A concise overview of the round."],
                        "bullet_points": [],
                        "subsections": [],
                    },
                    {
                        "heading": "Accepted Round Themes",
                        "paragraphs": [],
                        "bullet_points": [],
                        "subsections": [
                            {
                                "heading": "Workload pressure",
                                "paragraphs": ["Raised across multiple meetings."],
                                "bullet_points": ["Sustained high workload"],
                            }
                        ],
                    },
                ]
            },
        }
    )

    with patch("routers.rounds.get_client") as mock_get_client, \
         patch("routers.rounds.settings") as mock_settings:
        mock_settings.openai_api_key = "sk-test"
        mock_settings.openai_model = "gpt-4o-mini"
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_completion
        mock_get_client.return_value = mock_client

        resp = client.post("/rounds/generate-report", json=REPORT_PAYLOAD)

    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "March Cohort round report"
    assert body["report_document"]["sections"][0]["heading"] == "Executive Summary"
    assert body["report_document"]["sections"][1]["heading"] == "Priority Risks"
    assert body["report_document"]["sections"][1]["subsections"][0]["heading"] == "Workload pressure"
    assert body["content"] == "\n".join(
        [
            "## Executive Summary",
            "",
            "A concise overview of the round.",
            "",
            "## Priority Risks",
            "",
            "### Workload pressure",
            "",
            "Raised across multiple meetings.",
            "",
            "- Sustained high workload",
        ]
    )


def test_generate_round_report_realigns_top_level_sections_to_template_outline():
    mock_completion = _mock_openai_response(
        {
            "title": "March Cohort round report",
            "report_document": {
                "sections": [
                    {
                        "heading": "Wrong Heading",
                        "paragraphs": ["Model used the wrong heading but correct content."],
                        "bullet_points": [],
                        "subsections": [],
                    },
                    {
                        "heading": "Another Wrong Heading",
                        "paragraphs": ["Second section content."],
                        "bullet_points": [],
                        "subsections": [],
                    },
                    {
                        "heading": "Extra Section",
                        "paragraphs": ["This should be dropped."],
                        "bullet_points": [],
                        "subsections": [],
                    },
                ]
            },
        }
    )

    with patch("routers.rounds.get_client") as mock_get_client, \
         patch("routers.rounds.settings") as mock_settings:
        mock_settings.openai_api_key = "sk-test"
        mock_settings.openai_model = "gpt-4o-mini"
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_completion
        mock_get_client.return_value = mock_client

        resp = client.post("/rounds/generate-report", json=REPORT_PAYLOAD)

    assert resp.status_code == 200
    body = resp.json()
    assert [section["heading"] for section in body["report_document"]["sections"]] == [
        "Executive Summary",
        "Priority Risks",
    ]
    assert "## Extra Section" not in body["content"]


def test_generate_round_report_rejects_malformed_structured_document():
    mock_completion = _mock_openai_response(
        {
            "title": "March Cohort round report",
            "report_document": {
                "sections": [
                    {
                        "paragraphs": ["Missing heading should fail validation."],
                    }
                ]
            },
        }
    )

    with patch("routers.rounds.get_client") as mock_get_client, \
         patch("routers.rounds.settings") as mock_settings:
        mock_settings.openai_api_key = "sk-test"
        mock_settings.openai_model = "gpt-4o-mini"
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_completion
        mock_get_client.return_value = mock_client

        resp = client.post("/rounds/generate-report", json=REPORT_PAYLOAD)

    assert resp.status_code == 422
    assert "expected schema" in resp.json()["detail"].lower()
