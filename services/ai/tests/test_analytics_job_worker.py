from __future__ import annotations

from types import SimpleNamespace

from workers import analytics_job_worker
from workers.analytics_job_worker import ClaimedJob


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


def test_poll_once_claims_meeting_scoped_job(monkeypatch) -> None:
    engine = FakeEngine(
        [
            {
                "id": "job-1",
                "meeting_id": "meeting-1",
                "consultation_id": "consultation-1",
            }
        ]
    )
    captured = {}

    def fake_process_job(_engine, job):
        captured["job"] = job

    monkeypatch.setattr(analytics_job_worker, "_process_job", fake_process_job)

    processed = analytics_job_worker.poll_once(engine)

    assert processed == 1
    assert captured["job"] == ClaimedJob(
        id="job-1",
        meeting_id="meeting-1",
        consultation_id="consultation-1",
    )


def test_fetch_transcript_reads_from_meetings_table() -> None:
    engine = FakeEngine([{"transcript_raw": "verbatim transcript"}])

    transcript = analytics_job_worker._fetch_transcript(engine, "meeting-42")

    assert transcript == "verbatim transcript"
    query, params = engine.connection.calls[0]
    assert "FROM meetings" in query
    assert params == {"meeting_id": "meeting-42"}


def test_save_extraction_result_uses_meeting_scoped_columns(monkeypatch) -> None:
    engine = FakeEngine([{"id": "result-1"}])
    monkeypatch.setattr(
        analytics_job_worker,
        "_sql",
        lambda query: query,
    )

    job = ClaimedJob(id="job-1", meeting_id="meeting-1", consultation_id="consultation-1")
    extraction_result = SimpleNamespace(
        metadata=SimpleNamespace(
            fallback_used=False,
            duration_ms=150,
            confidence=0.87,
            reduced_recall=False,
            errors=[],
        ),
        terms=[
            SimpleNamespace(
                term="workload",
                original="workload",
                confidence=0.91,
                extraction_source="langextract",
                pos_tags=[],
                negation_context=False,
                    offsets=[SimpleNamespace(start=6, end=14)],
            )
        ],
    )

    class FakeSettings:
        openai_model = "gpt-test"

    monkeypatch.setitem(__import__("sys").modules, "core.config", SimpleNamespace(settings=FakeSettings()))

    analytics_job_worker._save_extraction_result(engine, job, extraction_result, "hello workload world")

    insert_query, insert_params = engine.connection.calls[0]
    assert "INSERT INTO extraction_results" in insert_query
    assert insert_params["meeting_id"] == "meeting-1"
    assert insert_params["consultation_id"] == "consultation-1"

    offset_query, offset_params = engine.connection.calls[1]
    assert "INSERT INTO term_extraction_offsets" in offset_query
    assert offset_params["meeting_id"] == "meeting-1"
    assert offset_params["source_span"] == "workload"


def test_ensure_analytics_projection_refresh_compatibility_recreates_trigger(monkeypatch) -> None:
    engine = FakeEngine()
    monkeypatch.setattr(analytics_job_worker, "_sql", lambda query: query)

    analytics_job_worker.ensure_analytics_projection_refresh_compatibility(engine)

    assert len(engine.connection.calls) == 1
    query, params = engine.connection.calls[0]
    assert params is None
    assert "CREATE OR REPLACE FUNCTION enqueue_analytics_projection_refresh()" in query
    assert "DROP TRIGGER IF EXISTS trg_extraction_results_outbox ON extraction_results" in query
    assert "CREATE TRIGGER trg_extraction_results_outbox" in query


def test_run_clustering_writes_consultation_and_meeting_memberships(monkeypatch) -> None:
    engine = FakeEngine()
    job = ClaimedJob(id="job-1", meeting_id="meeting-1", consultation_id="consultation-1")

    cluster_result = SimpleNamespace(
        clusters=[
            SimpleNamespace(
                cluster_id=7,
                label="workload",
                representative_terms=["workload"],
                all_terms=["workload"],
                meeting_count=1,
            )
        ],
        memberships=[
            SimpleNamespace(
                meeting_id="meeting-1",
                term="workload",
                cluster_id=7,
                membership_probability=0.93,
            )
        ],
    )

    monkeypatch.setattr(analytics_job_worker, "_sql", lambda query: query)
    monkeypatch.setitem(
        __import__("sys").modules,
        "clustering.service",
        SimpleNamespace(cluster_round_result=lambda consultation_id, _conn: cluster_result),
    )

    analytics_job_worker._run_clustering(engine, job)

    calls = engine.connection.calls
    assert calls[0][1] == {"consultation_id": "consultation-1"}
    assert calls[1][1] == {"consultation_id": "consultation-1"}

    cluster_insert = calls[2][1]
    assert cluster_insert["consultation_id"] == "consultation-1"
    assert cluster_insert["consultation_count"] == 1

    membership_insert = calls[3][1]
    assert membership_insert["consultation_id"] == "consultation-1"
    assert membership_insert["meeting_id"] == "meeting-1"