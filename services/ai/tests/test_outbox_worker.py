from __future__ import annotations

import json

from workers import outbox_worker
from workers.neo4j_sync import Neo4jGraphProjector
from workers.outbox_worker import AnalyticsOutboxEvent, coerce_outbox_event, process_pending_events


class FakeDb:
    def __init__(self, rows):
        self.rows = rows
        self.calls = []

    def execute(self, query, params=None):
        query_text = str(query)
        self.calls.append((query_text, params))
        if "FROM analytics_outbox" in query_text:
            return self.rows
        return []


class EnabledProjector(Neo4jGraphProjector):
    def __init__(self):
        self.enabled = True


def test_coerce_outbox_event_uses_meeting_and_consultation_ids() -> None:
    event = coerce_outbox_event(
        {
            "id": 7,
            "meeting_id": "meeting-1",
            "consultation_id": "consultation-1",
            "event_type": "consultation_projection_refresh",
            "source_table": "extraction_results",
            "source_id": "result-1",
            "payload": {"meetingId": "meeting-1", "consultationId": "consultation-1"},
            "attempt_count": 2,
            "last_error": None,
            "processed_at": None,
            "created_at": None,
        }
    )

    assert event.id == 7
    assert event.meeting_id == "meeting-1"
    assert event.consultation_id == "consultation-1"
    assert event.payload["meetingId"] == "meeting-1"


def test_coerce_outbox_event_parses_json_payload() -> None:
    event = coerce_outbox_event(
        {
            "id": 7,
            "meeting_id": "meeting-1",
            "consultation_id": "consultation-1",
            "event_type": "consultation_projection_refresh",
            "source_table": "extraction_results",
            "source_id": "result-1",
            "payload": json.dumps({"meetingId": "meeting-1", "consultationId": "consultation-1"}),
            "attempt_count": 2,
            "last_error": None,
            "processed_at": None,
            "created_at": "2026-03-20T00:00:00+00:00",
        }
    )

    assert isinstance(event, AnalyticsOutboxEvent)
    assert event.meeting_id == "meeting-1"
    assert event.payload["consultationId"] == "consultation-1"
    assert event.attempt_count == 2


def test_process_pending_events_is_noop_when_projector_disabled() -> None:
    db = FakeDb(rows=[])
    projector = Neo4jGraphProjector(env={})

    assert process_pending_events(db, projector=projector) == 0
    assert db.calls == []


def test_process_pending_events_marks_rows_processed(monkeypatch) -> None:
    db = FakeDb(
        rows=[
            {
                "id": 7,
                "meeting_id": "meeting-1",
                "consultation_id": "consultation-1",
                "event_type": "consultation_projection_refresh",
                "source_table": "extraction_results",
                "source_id": "result-1",
                "payload": {"meetingId": "meeting-1", "consultationId": "consultation-1"},
                "attempt_count": 0,
                "last_error": None,
                "processed_at": None,
                "created_at": "2026-03-20T00:00:00+00:00",
            }
        ]
    )

    calls: list[str] = []

    def fake_refresh(_db, consultation_id, projector):
        calls.append(f"{consultation_id}:{projector.enabled}")
        return True

    monkeypatch.setattr(outbox_worker, "refresh_consultation_projection", fake_refresh)

    processed = process_pending_events(db, projector=EnabledProjector(), batch_size=10)

    assert processed == 1
    assert calls == ["consultation-1:True"]
    assert any("SET processed_at = now()" in query for query, _ in db.calls)


def test_process_pending_events_marks_failures(monkeypatch) -> None:
    db = FakeDb(
        rows=[
            {
                "id": 9,
                "meeting_id": "meeting-9",
                "consultation_id": "consultation-9",
                "event_type": "consultation_projection_refresh",
                "source_table": "extraction_results",
                "source_id": "result-9",
                "payload": {"meetingId": "meeting-9", "consultationId": "consultation-9"},
                "attempt_count": 0,
                "last_error": None,
                "processed_at": None,
                "created_at": "2026-03-20T00:00:00+00:00",
            }
        ]
    )

    def fake_refresh(_db, consultation_id, projector):
        raise RuntimeError(f"failed:{consultation_id}")

    monkeypatch.setattr(outbox_worker, "refresh_consultation_projection", fake_refresh)

    processed = process_pending_events(db, projector=EnabledProjector(), batch_size=10)

    assert processed == 0
    failure_calls = [params for query, params in db.calls if "attempt_count = attempt_count + 1" in query]
    assert failure_calls == [{"id": 9, "error": "failed:consultation-9"}]
