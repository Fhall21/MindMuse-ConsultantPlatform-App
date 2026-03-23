from __future__ import annotations

import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core.learning_analyzer import AIInsightLearning
from workers import learning_task


class FakeResult:
    def __init__(self, rows=None):
        self.rows = rows or []

    def mappings(self):
        return self.rows


class FakeConnection:
    def __init__(self):
        self.calls = []

    def execute(self, query, params=None):
        self.calls.append((str(query), params))
        return FakeResult()


class FakeBegin:
    def __init__(self, connection: FakeConnection):
        self.connection = connection

    def __enter__(self):
        return self.connection

    def __exit__(self, exc_type, exc, tb):
        return False


class FakeEngine:
    def __init__(self):
        self.connection = FakeConnection()

    def begin(self):
        return FakeBegin(self.connection)


def test_run_compute_user_learnings_replaces_existing_rows(monkeypatch) -> None:
    engine = FakeEngine()
    learning = AIInsightLearning(
        user_id="user-1",
        topic_type="theme_generation",
        learning_type="trend",
        label="Strong interest in Return To Work Barriers",
        description="2 of the last 3 accepted insights focused on return to work barriers.",
        supporting_metrics={"accepted_count": 2, "percentage": 66.7},
        created_at=datetime(2026, 3, 23, tzinfo=timezone.utc),
    )

    monkeypatch.setattr(learning_task, "analyze_user_signals", lambda *_args, **_kwargs: [learning])
    monkeypatch.setattr(learning_task, "_sql", lambda query: query)

    result = learning_task.run_compute_user_learnings("user-1", engine=engine)

    assert result["learning_count"] == 1
    assert len(engine.connection.calls) == 2
    delete_query, delete_params = engine.connection.calls[0]
    assert "DELETE FROM ai_insight_learnings" in delete_query
    assert delete_params == {"user_id": "user-1", "topic_type": "theme_generation"}

    insert_query, insert_params = engine.connection.calls[1]
    assert "INSERT INTO ai_insight_learnings" in insert_query
    assert insert_params["learning_type"] == "trend"
    assert '"accepted_count": 2' in insert_params["supporting_metrics"]


def test_run_compute_user_learnings_clears_existing_rows_when_no_learnings(monkeypatch) -> None:
    engine = FakeEngine()

    monkeypatch.setattr(learning_task, "analyze_user_signals", lambda *_args, **_kwargs: [])
    monkeypatch.setattr(learning_task, "_sql", lambda query: query)

    result = learning_task.run_compute_user_learnings("user-2", engine=engine)

    assert result == {
        "status": "completed",
        "user_id": "user-2",
        "topic_type": "theme_generation",
        "learning_count": 0,
    }
    assert len(engine.connection.calls) == 1
    query, params = engine.connection.calls[0]
    assert "DELETE FROM ai_insight_learnings" in query
    assert params == {"user_id": "user-2", "topic_type": "theme_generation"}