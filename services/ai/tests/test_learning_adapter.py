from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core.learning_adapter import build_personalization_prompt
from models.schemas import AIInsightLearning, LearningSignal, UserPreferences


def test_build_personalization_prompt_returns_empty_for_no_context() -> None:
    assert build_personalization_prompt([], None, []) == ""


def test_build_personalization_prompt_includes_preferences_without_signals() -> None:
    preferences = UserPreferences(
        consultation_types=["return to work assessment"],
        focus_areas=["workload", "supervisor support"],
        excluded_topics=["scheduling logistics"],
    )

    prompt = build_personalization_prompt([], preferences, [])

    assert "Saved user preferences" in prompt
    assert '"workload"' in prompt
    assert '"return to work assessment"' in prompt
    assert '"scheduling logistics"' in prompt


def test_build_personalization_prompt_merges_signals_and_preferences() -> None:
    signals = [
        LearningSignal(label="Return to work barriers", decision_type="accept", weight=1.0),
        LearningSignal(label="Generic wellbeing", decision_type="reject", rationale="too vague", weight=1.0),
    ]
    preferences = UserPreferences(
        consultation_types=["barrier assessment"],
        focus_areas=["return to work"],
        excluded_topics=[],
    )

    prompt = build_personalization_prompt(signals, preferences, [])

    assert "previously rejected these themes" in prompt
    assert "Saved user preferences" in prompt
    assert '"return to work"' in prompt


def test_build_personalization_prompt_includes_persisted_learnings() -> None:
    learnings = [
        AIInsightLearning(
            id="learning-1",
            user_id="user-1",
            topic_type="theme_generation",
            learning_type="trend",
            label="Return to work barriers",
            description="These themes are consistently accepted when the transcript covers work capacity and employer friction.",
            supporting_metrics={"accepted_count": 4, "percentage": 0.8},
            created_at="2026-03-23T00:00:00Z",
            expires_at=None,
            version=1,
        ),
        AIInsightLearning(
            id="learning-2",
            user_id="user-1",
            topic_type="theme_generation",
            learning_type="rejection_signal",
            label="Generic wellbeing",
            description="Broad wellbeing framing is often rejected unless there is clear psychosocial substance.",
            supporting_metrics={"rejection_reasons": {"too vague": 3}},
            created_at="2026-03-23T00:00:00Z",
            expires_at=None,
            version=1,
        ),
    ]

    prompt = build_personalization_prompt([], None, learnings)

    assert "Persisted AI learnings from prior review history" in prompt
    assert "Accepted trend 'Return to work barriers'" in prompt
    assert "Common rejection reasons: too vague" in prompt