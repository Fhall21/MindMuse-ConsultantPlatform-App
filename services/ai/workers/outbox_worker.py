from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from workers.neo4j_sync import Neo4jGraphProjector, build_database_url, refresh_consultation_projection


PENDING_OUTBOX_EVENTS_QUERY = """
SELECT
    id,
    meeting_id,
    consultation_id,
    event_type,
    source_table,
    source_id,
    payload,
    attempt_count,
    last_error,
    processed_at,
    created_at
FROM analytics_outbox
WHERE processed_at IS NULL
ORDER BY id
LIMIT :batch_size
FOR UPDATE SKIP LOCKED
"""

MARK_OUTBOX_EVENT_PROCESSED_QUERY = """
UPDATE analytics_outbox
SET processed_at = now(),
    last_error = NULL
WHERE id = :id
"""

MARK_OUTBOX_EVENT_FAILED_QUERY = """
UPDATE analytics_outbox
SET attempt_count = attempt_count + 1,
    last_error = :error
WHERE id = :id
"""


@dataclass
class AnalyticsOutboxEvent:
    id: int
    meeting_id: str
    consultation_id: str
    event_type: str
    source_table: str
    source_id: str
    payload: Mapping[str, Any]
    attempt_count: int
    last_error: str | None
    processed_at: str | None
    created_at: str | None


def create_db_engine(env: Mapping[str, str] | None = None) -> Any:
    database_url = build_database_url(env)
    if not database_url:
        raise ValueError("DATABASE_URL or DATABASE_* variables are required for the analytics outbox worker.")

    from sqlalchemy import create_engine

    return create_engine(database_url, future=True)


def load_pending_events(db: Any, batch_size: int = 100) -> list[AnalyticsOutboxEvent]:
    result = db.execute(_sql_text(PENDING_OUTBOX_EVENTS_QUERY), {"batch_size": batch_size})
    return [coerce_outbox_event(row) for row in _result_records(result)]


def coerce_outbox_event(row: Mapping[str, Any]) -> AnalyticsOutboxEvent:
    return AnalyticsOutboxEvent(
        id=int(row["id"]),
        meeting_id=str(row["meeting_id"]),
        consultation_id=str(row["consultation_id"]),
        event_type=str(row["event_type"]),
        source_table=str(row["source_table"]),
        source_id=str(row["source_id"]),
        payload=_coerce_payload(row.get("payload")),
        attempt_count=int(row.get("attempt_count", 0)),
        last_error=_optional_str(row.get("last_error")),
        processed_at=_optional_str(row.get("processed_at")),
        created_at=_optional_str(row.get("created_at")),
    )


def process_pending_events(
    db: Any,
    projector: Neo4jGraphProjector | None = None,
    *,
    batch_size: int = 100,
) -> int:
    neo4j_projector = projector or Neo4jGraphProjector()
    if not neo4j_projector.enabled:
        return 0

    processed = 0
    for event in load_pending_events(db, batch_size=batch_size):
        try:
            _process_event(db, event, neo4j_projector)
            db.execute(_sql_text(MARK_OUTBOX_EVENT_PROCESSED_QUERY), {"id": event.id})
            processed += 1
        except Exception as exc:  # noqa: BLE001
            db.execute(
                _sql_text(MARK_OUTBOX_EVENT_FAILED_QUERY),
                {"id": event.id, "error": str(exc)},
            )
    return processed


def run_outbox_worker(
    *,
    batch_size: int = 100,
    env: Mapping[str, str] | None = None,
    projector: Neo4jGraphProjector | None = None,
) -> int:
    engine = create_db_engine(env)
    with engine.begin() as connection:
        return process_pending_events(connection, projector=projector, batch_size=batch_size)


def _process_event(db: Any, event: AnalyticsOutboxEvent, projector: Neo4jGraphProjector) -> None:
    if event.event_type != "consultation_projection_refresh":
        raise ValueError(f"Unsupported analytics outbox event type: {event.event_type}")

    refresh_consultation_projection(
        db,
        consultation_id=event.consultation_id,
        projector=projector,
    )


def _coerce_payload(value: Any) -> Mapping[str, Any]:
    if value is None:
        return {}
    if isinstance(value, Mapping):
        return value
    if isinstance(value, str):
        import json

        return json.loads(value)
    raise TypeError("Unsupported analytics outbox payload type.")


def _optional_str(value: Any) -> str | None:
    if value is None:
        return None
    return str(value)


def _result_records(result: Any) -> list[Mapping[str, Any]]:
    if hasattr(result, "mappings"):
        return list(result.mappings())

    records: list[Mapping[str, Any]] = []
    for row in result:
        if isinstance(row, Mapping):
            records.append(row)
        elif hasattr(row, "_mapping"):
            records.append(row._mapping)
        else:
            raise TypeError("Unsupported row type returned while loading analytics outbox events.")
    return records


def _sql_text(query: str) -> Any:
    try:
        from sqlalchemy import text
    except ModuleNotFoundError:
        return query
    return text(query)
