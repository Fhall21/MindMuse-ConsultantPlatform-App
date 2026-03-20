from __future__ import annotations

from workers.neo4j_sync import (
    ConsultationProjection,
    ConsultationProjectionTerm,
    Neo4jGraphProjector,
    build_database_url,
    load_consultation_projection,
)


class FakeDb:
    def __init__(self, rows):
        self.rows = rows
        self.calls = []

    def execute(self, query, params=None):
        self.calls.append((query, params))
        return self.rows


class FakeSession:
    def __init__(self, calls):
        self.calls = calls

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def run(self, query, parameters=None):
        self.calls.append((query, parameters))
        return None


class FakeDriver:
    def __init__(self):
        self.calls = []

    def session(self):
        return FakeSession(self.calls)

    def close(self):
        return None


def test_build_database_url_prefers_database_url() -> None:
    assert (
        build_database_url({"DATABASE_URL": "postgresql+psycopg://example"})
        == "postgresql+psycopg://example"
    )


def test_build_database_url_from_split_env() -> None:
    assert build_database_url(
        {
            "DATABASE_HOST": "db",
            "DATABASE_PORT": "5433",
            "DATABASE_NAME": "consultant_platform",
            "DATABASE_USER": "postgres",
            "DATABASE_PASSWORD": "secret",
        }
    ) == "postgresql+psycopg://postgres:secret@db:5433/consultant_platform"


def test_load_consultation_projection_shapes_term_payload() -> None:
    db = FakeDb(
        [
            {
                "consultation_id": "consultation-1",
                "round_id": "round-1",
                "term": "burnout",
                "entity_type": "ISSUE",
                "occurrence_count": 2,
                "offsets": [
                    {"charStart": 12, "charEnd": 19, "sourceSpan": "burnout"},
                    {"charStart": 42, "charEnd": 49, "sourceSpan": "burnout"},
                ],
            },
            {
                "consultation_id": "consultation-1",
                "round_id": "round-1",
                "term": "housing",
                "entity_type": "ISSUE",
                "occurrence_count": 1,
                "offsets": [{"charStart": 80, "charEnd": 87, "sourceSpan": "housing"}],
            },
        ]
    )

    projection = load_consultation_projection(db, "consultation-1")

    assert projection is not None
    assert projection.consultation_id == "consultation-1"
    assert projection.round_id == "round-1"
    assert [term.term for term in projection.terms] == ["burnout", "housing"]
    assert projection.terms[0].to_dict()["offsets"][0]["charStart"] == 12
    assert db.calls[0][1] == {"consultation_id": "consultation-1"}


def test_projector_is_safe_noop_without_env() -> None:
    projector = Neo4jGraphProjector(env={})

    assert projector.enabled is False
    assert (
        projector.project_consultation(
            ConsultationProjection(
                consultation_id="consultation-1",
                round_id=None,
                terms=[ConsultationProjectionTerm("burnout", "ISSUE", 1)],
                synced_at="2026-03-20T00:00:00+00:00",
            )
        )
        is False
    )
    assert projector.delete_consultation_projection("consultation-1") is False


def test_projector_writes_cypher_when_driver_is_available() -> None:
    driver = FakeDriver()
    projector = Neo4jGraphProjector(driver=driver, env={})

    projection = ConsultationProjection(
        consultation_id="consultation-1",
        round_id="round-1",
        terms=[
            ConsultationProjectionTerm(
                term="burnout",
                entity_type="ISSUE",
                occurrence_count=2,
                offsets=[{"charStart": 4, "charEnd": 11, "sourceSpan": "burnout"}],
            )
        ],
        synced_at="2026-03-20T00:00:00+00:00",
    )

    assert projector.project_consultation(projection) is True
    assert projector.delete_consultation_projection("consultation-1") is True
    assert len(driver.calls) == 2
    assert driver.calls[0][1]["consultationId"] == "consultation-1"
    assert driver.calls[0][1]["terms"][0]["occurrenceCount"] == 2
    assert driver.calls[1][1] == {"consultationId": "consultation-1"}
