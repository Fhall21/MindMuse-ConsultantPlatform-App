from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core import learning_analyzer


class FakeResult:
    def __init__(self, rows):
        self.rows = rows

    def mappings(self):
        return self.rows


class FakeConnection:
    def __init__(self, rows=None):
        self.rows = rows or []
        self.calls = []

    def execute(self, query, params=None):
        self.calls.append((str(query), params))
        return FakeResult(self.rows)


class FakeBegin:
    def __init__(self, connection: FakeConnection):
        self.connection = connection

    def __enter__(self):
        return self.connection

    def __exit__(self, exc_type, exc, tb):
        return False


class FakeEngine:
    def __init__(self, rows=None):
        self.connection = FakeConnection(rows)

    def begin(self):
        return FakeBegin(self.connection)


def test_analyze_user_signals_returns_empty_for_sparse_history(monkeypatch) -> None:
    sparse_history = [
        {"insight_label": "Return to work barrier", "decision_type": "accept", "rationale": None},
        {"insight_label": "Supervisor contact", "decision_type": "reject", "rationale": "too vague"},
        {"insight_label": "Fatigue pattern", "decision_type": "accept", "rationale": None},
        {"insight_label": "Admin follow-up", "decision_type": "user_added", "rationale": None},
    ]

    monkeypatch.setattr(learning_analyzer, "_create_db_engine", lambda: object())
    monkeypatch.setattr(learning_analyzer, "_fetch_recent_signals", lambda *_args: sparse_history)

    learnings = learning_analyzer.analyze_user_signals("user-1")

    assert learnings == []


def test_analyze_user_signals_generates_expected_learning_types(monkeypatch) -> None:
    signal_history = [
        {"insight_label": "Return to work barriers", "decision_type": "accept", "rationale": None},
        {"insight_label": "Return to work barriers", "decision_type": "accept", "rationale": None},
        {"insight_label": "Communication barriers", "decision_type": "user_added", "rationale": None},
        {"insight_label": "Workload barriers", "decision_type": "accept", "rationale": None},
        {"insight_label": "General workplace stress", "decision_type": "reject", "rationale": "too vague"},
        {"insight_label": "Admin updates", "decision_type": "reject", "rationale": "not psychosocial"},
    ]
    preferences = {
        "consultation_types": ["barrier assessment"],
        "focus_areas": ["return to work"],
        "excluded_topics": [],
    }

    monkeypatch.setattr(learning_analyzer, "_create_db_engine", lambda: object())
    monkeypatch.setattr(learning_analyzer, "_fetch_recent_signals", lambda *_args: signal_history)
    monkeypatch.setattr(learning_analyzer, "_fetch_user_preferences", lambda *_args: preferences)

    learnings = learning_analyzer.analyze_user_signals("user-1")

    learning_types = {learning.learning_type for learning in learnings}

    assert learning_types == {
        "process_pattern",
        "trend",
        "rejection_signal",
        "preference_alignment",
    }
    process_pattern = next(learning for learning in learnings if learning.learning_type == "process_pattern")
    trend = next(learning for learning in learnings if learning.learning_type == "trend")
    rejection_signal = next(learning for learning in learnings if learning.learning_type == "rejection_signal")
    preference_alignment = next(
        learning for learning in learnings if learning.learning_type == "preference_alignment"
    )

    assert "barriers" in process_pattern.label.lower()
    assert trend.supporting_metrics["accepted_count"] == 2
    assert rejection_signal.supporting_metrics["rejection_reasons"]["too vague"] == 1
    assert preference_alignment.supporting_metrics["alignment_count"] >= 1


def test_fetch_recent_signals_reads_ordered_user_history() -> None:
    engine = FakeEngine(
        [
            {
                "insight_label": "Return to work barriers",
                "decision_type": "accept",
                "rationale": None,
                "created_at": "2026-03-23T10:00:00Z",
            }
        ]
    )

    rows = learning_analyzer._fetch_recent_signals(engine, "user-42", 25)

    assert rows[0]["decision_type"] == "accept"
    query, params = engine.connection.calls[0]
    assert "FROM insight_decision_logs" in query
    assert "ORDER BY created_at DESC" in query
    assert params == {"user_id": "user-42", "limit": 25}


def test_fetch_user_preferences_defaults_to_empty_lists() -> None:
    engine = FakeEngine([])

    preferences = learning_analyzer._fetch_user_preferences(engine, "user-7")

    query, params = engine.connection.calls[0]
    assert "FROM user_ai_preferences" in query
    assert params == {"user_id": "user-7"}
    assert preferences == {
        "consultation_types": [],
        "focus_areas": [],
        "excluded_topics": [],
    }