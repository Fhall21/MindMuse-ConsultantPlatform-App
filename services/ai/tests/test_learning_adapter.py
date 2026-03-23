from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core.learning_adapter import build_personalization_prompt
from models.schemas import LearningSignal, UserPreferences


def test_build_personalization_prompt_returns_empty_for_no_context() -> None:
    assert build_personalization_prompt([], None) == ""


def test_build_personalization_prompt_includes_preferences_without_signals() -> None:
    preferences = UserPreferences(
        consultation_types=["return to work assessment"],
        focus_areas=["workload", "supervisor support"],
        excluded_topics=["scheduling logistics"],
    )

    prompt = build_personalization_prompt([], preferences)

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

    prompt = build_personalization_prompt(signals, preferences)

    assert "previously rejected these themes" in prompt
    assert "Saved user preferences" in prompt
    assert '"return to work"' in prompt