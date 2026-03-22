from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterable, Mapping, Protocol, TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.engine import Connection
else:  # pragma: no cover - typing-only import
    Connection = Any


CONSULTATION_PROJECTION_QUERY = """
WITH latest_extraction AS (
    SELECT id, consultation_id
    FROM extraction_results
    WHERE consultation_id = :consultation_id
    ORDER BY extracted_at DESC, created_at DESC
    LIMIT 1
)
SELECT
    latest_extraction.consultation_id,
    teo.term,
    teo.entity_type,
    COUNT(*)::int AS occurrence_count,
    jsonb_agg(
        jsonb_build_object(
            'charStart', teo.char_start,
            'charEnd', teo.char_end,
            'sourceSpan', teo.source_span
        )
        ORDER BY teo.char_start, teo.char_end
    ) AS offsets
FROM latest_extraction
JOIN term_extraction_offsets AS teo
    ON teo.extraction_result_id = latest_extraction.id
GROUP BY
    latest_extraction.consultation_id,
    teo.term,
    teo.entity_type
ORDER BY teo.term, teo.entity_type
"""

ALL_PROJECTED_CONSULTATIONS_QUERY = """
SELECT DISTINCT consultation_id
FROM extraction_results
ORDER BY consultation_id
"""

DELETE_CONSULTATION_PROJECTION_QUERY = """
MATCH (c:Consultation {id: $consultationId})
OPTIONAL MATCH (t:Term)-[appears:APPEARS_IN]->(c)
DELETE appears
WITH c
DETACH DELETE c
"""

UPSERT_CONSULTATION_PROJECTION_QUERY = """
MERGE (c:Consultation {id: $consultationId})
SET c.updatedAt = datetime($syncedAt)
WITH c
OPTIONAL MATCH (t:Term)-[stale:APPEARS_IN]->(c)
DELETE stale
WITH c
UNWIND $terms AS term
MERGE (t:Term {value: term.term, entityType: term.entityType})
SET t.updatedAt = datetime($syncedAt)
MERGE (t)-[appears:APPEARS_IN]->(c)
SET appears.occurrenceCount = term.occurrenceCount,
    appears.offsets = term.offsets,
    appears.updatedAt = datetime($syncedAt)
"""


class Neo4jSessionLike(Protocol):
    def run(self, query: str, parameters: Mapping[str, Any] | None = None) -> Any:
        ...


class Neo4jDriverLike(Protocol):
    def session(self) -> Neo4jSessionLike:
        ...

    def close(self) -> None:
        ...


@dataclass
class ConsultationProjectionTerm:
    term: str
    entity_type: str
    occurrence_count: int
    offsets: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "term": self.term,
            "entityType": self.entity_type,
            "occurrenceCount": self.occurrence_count,
            "offsets": self.offsets,
        }


@dataclass
class ConsultationProjection:
    consultation_id: str
    terms: list[ConsultationProjectionTerm]
    synced_at: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "consultationId": self.consultation_id,
            "terms": [term.to_dict() for term in self.terms],
            "syncedAt": self.synced_at,
        }


def build_database_url(env: Mapping[str, str] | None = None) -> str | None:
    source = env or os.environ
    if source.get("DATABASE_URL"):
        return source["DATABASE_URL"]

    host = source.get("DATABASE_HOST")
    port = source.get("DATABASE_PORT", "5432")
    database = source.get("DATABASE_NAME")
    user = source.get("DATABASE_USER")
    password = source.get("DATABASE_PASSWORD")
    if not all([host, database, user, password]):
        return None
    return f"postgresql+psycopg://{user}:{password}@{host}:{port}/{database}"


def neo4j_env_config(env: Mapping[str, str] | None = None) -> tuple[str | None, str | None, str | None]:
    source = env or os.environ
    return (
        source.get("NEO4J_URI"),
        source.get("NEO4J_USER"),
        source.get("NEO4J_PASSWORD"),
    )


class Neo4jGraphProjector:
    def __init__(
        self,
        *,
        driver: Neo4jDriverLike | None = None,
        env: Mapping[str, str] | None = None,
    ) -> None:
        self._env = env or os.environ
        self.driver = driver or _build_neo4j_driver(self._env)
        self.enabled = self.driver is not None

    def close(self) -> None:
        if self.driver is not None:
            self.driver.close()

    def delete_consultation_projection(self, consultation_id: str) -> bool:
        if not self.enabled or self.driver is None:
            return False

        with self.driver.session() as session:
            session.run(
                DELETE_CONSULTATION_PROJECTION_QUERY,
                {"consultationId": consultation_id},
            )
        return True

    def project_consultation(self, projection: ConsultationProjection) -> bool:
        if not self.enabled or self.driver is None:
            return False

        with self.driver.session() as session:
            session.run(
                UPSERT_CONSULTATION_PROJECTION_QUERY,
                projection.to_dict(),
            )
        return True


def load_consultation_projection(db: Connection, consultation_id: str) -> ConsultationProjection | None:
    rows = _result_records(db.execute(_sql_text(CONSULTATION_PROJECTION_QUERY), {"consultation_id": consultation_id}))
    if not rows:
        return None

    first_row = rows[0]
    terms: list[ConsultationProjectionTerm] = []
    for row in rows:
        terms.append(
            ConsultationProjectionTerm(
                term=str(row["term"]),
                entity_type=str(row["entity_type"]),
                occurrence_count=int(row["occurrence_count"]),
                offsets=_coerce_offsets(row["offsets"]),
            )
        )

    return ConsultationProjection(
        consultation_id=str(first_row["consultation_id"]),
        terms=terms,
        synced_at=_utc_now_iso(),
    )


def refresh_consultation_projection(
    db: Connection,
    consultation_id: str,
    projector: Neo4jGraphProjector | None = None,
) -> bool:
    neo4j_projector = projector or Neo4jGraphProjector()
    projection = load_consultation_projection(db, consultation_id)
    if projection is None:
        return neo4j_projector.delete_consultation_projection(consultation_id)
    return neo4j_projector.project_consultation(projection)


def rebuild_all_projections(
    db: Connection,
    projector: Neo4jGraphProjector | None = None,
    *,
    consultation_ids: Iterable[str] | None = None,
) -> int:
    neo4j_projector = projector or Neo4jGraphProjector()
    ids = list(consultation_ids) if consultation_ids is not None else load_projected_consultation_ids(db)

    rebuilt = 0
    for consultation_id in ids:
        if refresh_consultation_projection(db, consultation_id, neo4j_projector):
            rebuilt += 1
    return rebuilt


def load_projected_consultation_ids(db: Connection) -> list[str]:
    rows = _result_records(db.execute(_sql_text(ALL_PROJECTED_CONSULTATIONS_QUERY)))
    return [str(row["consultation_id"]) for row in rows]


def _build_neo4j_driver(env: Mapping[str, str]) -> Neo4jDriverLike | None:
    uri, user, password = neo4j_env_config(env)
    if not all([uri, user, password]):
        return None

    try:
        from neo4j import GraphDatabase
    except ModuleNotFoundError:
        return None

    return GraphDatabase.driver(uri, auth=(user, password))


def _coerce_offsets(value: Any) -> list[dict[str, Any]]:
    raw = value
    if raw is None:
        return []
    if isinstance(raw, str):
        raw = json.loads(raw)
    return [dict(item) for item in raw]


def _optional_str(value: Any) -> str | None:
    if value is None:
        return None
    return str(value)


def _result_records(result: Any) -> list[Mapping[str, Any]]:
    if hasattr(result, "mappings"):
        return list(result.mappings())

    if isinstance(result, Iterable):
        records: list[Mapping[str, Any]] = []
        for row in result:
            if isinstance(row, Mapping):
                records.append(row)
            elif hasattr(row, "_mapping"):
                records.append(row._mapping)
            else:
                raise TypeError("Unsupported row type returned while loading analytics projections.")
        return records

    raise TypeError("Unsupported DB execute() result while loading analytics projections.")


def _sql_text(query: str) -> Any:
    try:
        from sqlalchemy import text
    except ModuleNotFoundError:
        return query
    return text(query)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
