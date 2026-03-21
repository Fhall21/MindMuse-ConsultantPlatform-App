"""
Analytics job polling worker.

Polls analytics_jobs for queued rows and runs the full extraction →
embedding → clustering pipeline, writing results back to the DB and
advancing the job phase at each step.

One job is claimed and processed at a time to avoid concurrent round
re-clustering. Clustering runs per round using all embeddings accumulated
so far, so results improve as more consultations in a round are processed.

Phase transitions:
  queued → extracting (10%) → embedding (50%) → clustering (75%) → complete (100%)
  Any error → failed with error_message populated
"""
from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from typing import Any

from workers.neo4j_sync import build_database_url

logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = 10

# ─── SQL ──────────────────────────────────────────────────────────────────────

# Atomically claim one queued job by updating its phase in the same CTE.
CLAIM_QUEUED_JOB_QUERY = """
WITH claimed AS (
    SELECT id
    FROM analytics_jobs
    WHERE phase = 'queued'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
)
UPDATE analytics_jobs
SET phase       = 'extracting',
    progress    = 10,
    started_at  = now(),
    updated_at  = now()
FROM claimed
WHERE analytics_jobs.id = claimed.id
RETURNING analytics_jobs.id, analytics_jobs.consultation_id, analytics_jobs.round_id
"""

FETCH_TRANSCRIPT_QUERY = """
SELECT transcript_raw FROM consultations WHERE id = :consultation_id
"""

UPDATE_JOB_QUERY = """
UPDATE analytics_jobs
SET phase        = :phase,
    progress     = :progress,
    completed_at = CASE WHEN :phase IN ('complete', 'failed') THEN now() ELSE NULL END,
    error_message = :error_message,
    updated_at   = now()
WHERE id = :job_id
"""

INSERT_EXTRACTION_RESULT_QUERY = """
INSERT INTO extraction_results (
    consultation_id, round_id, extracted_at,
    extractor, model_version, transcript_word_count,
    duration_ms, confidence, fallback_used, reduced_recall,
    error_messages, result_json
) VALUES (
    :consultation_id, :round_id, now(),
    :extractor, :model_version, :transcript_word_count,
    :duration_ms, :confidence, :fallback_used, :reduced_recall,
    :error_messages::jsonb, :result_json::jsonb
)
RETURNING id
"""

INSERT_TERM_OFFSET_QUERY = """
INSERT INTO term_extraction_offsets (
    extraction_result_id, consultation_id,
    term, original, entity_type, confidence,
    char_start, char_end, source_span,
    extraction_source, pos_tags, negation_context
) VALUES (
    :extraction_result_id, :consultation_id,
    :term, :original, :entity_type, :confidence,
    :char_start, :char_end, :source_span,
    :extraction_source, :pos_tags::jsonb, :negation_context
)
"""

UPSERT_TERM_EMBEDDING_QUERY = """
INSERT INTO term_embeddings (consultation_id, term, entity_type, embedding)
VALUES (:consultation_id, :term, :entity_type, :embedding::vector)
ON CONFLICT (consultation_id, term, entity_type)
DO UPDATE SET embedding = EXCLUDED.embedding
"""

DELETE_ROUND_CLUSTERS_QUERY = """
DELETE FROM term_clusters WHERE round_id = :round_id
"""

DELETE_ROUND_MEMBERSHIPS_QUERY = """
DELETE FROM term_cluster_memberships WHERE round_id = :round_id
"""

INSERT_TERM_CLUSTER_QUERY = """
INSERT INTO term_clusters (
    round_id, cluster_id, label,
    representative_terms, all_terms, consultation_count
) VALUES (
    :round_id, :cluster_id, :label,
    :representative_terms::jsonb, :all_terms::jsonb, :consultation_count
)
"""

INSERT_TERM_MEMBERSHIP_QUERY = """
INSERT INTO term_cluster_memberships (
    round_id, consultation_id, term, cluster_id, membership_probability
) VALUES (
    :round_id, :consultation_id, :term, :cluster_id, :membership_probability
)
ON CONFLICT (round_id, consultation_id, term)
DO UPDATE SET
    cluster_id = EXCLUDED.cluster_id,
    membership_probability = EXCLUDED.membership_probability
"""


# ─── Data ─────────────────────────────────────────────────────────────────────

@dataclass
class ClaimedJob:
    id: str
    consultation_id: str
    round_id: str | None


# ─── Engine ───────────────────────────────────────────────────────────────────

def create_db_engine() -> Any:
    database_url = build_database_url()
    if not database_url:
        raise ValueError(
            "Analytics worker requires DATABASE_URL or DATABASE_HOST/PORT/NAME/USER/PASSWORD env vars."
        )
    from sqlalchemy import create_engine
    return create_engine(database_url, future=True, pool_pre_ping=True)


def _sql(query: str) -> Any:
    try:
        from sqlalchemy import text
    except ModuleNotFoundError:
        return query
    return text(query)


# ─── Poll loop ────────────────────────────────────────────────────────────────

def poll_once(engine: Any) -> int:
    """Claim and process up to one queued job. Returns 1 if a job ran, 0 if queue was empty."""
    with engine.begin() as conn:
        result = conn.execute(_sql(CLAIM_QUEUED_JOB_QUERY))
        rows = list(result.mappings())

    if not rows:
        return 0

    row = rows[0]
    job = ClaimedJob(
        id=str(row["id"]),
        consultation_id=str(row["consultation_id"]),
        round_id=str(row["round_id"]) if row["round_id"] else None,
    )
    _process_job(engine, job)
    return 1


# ─── Job processing ───────────────────────────────────────────────────────────

def _process_job(engine: Any, job: ClaimedJob) -> None:
    logger.info("[analytics_worker] job started", extra={
        "job_id": job.id,
        "consultation_id": job.consultation_id,
        "round_id": job.round_id,
    })
    try:
        # Extraction
        transcript = _fetch_transcript(engine, job.consultation_id)
        extraction_result = _run_extraction(transcript)
        _save_extraction_result(engine, job, extraction_result, transcript)

        # Embedding
        _set_phase(engine, job.id, "embedding", 50)
        _run_embedding(engine, job, extraction_result)

        # Clustering (only when a round is set and we have enough data)
        if job.round_id:
            _set_phase(engine, job.id, "clustering", 75)
            _run_clustering(engine, job)

        _set_phase(engine, job.id, "complete", 100)
        logger.info("[analytics_worker] job complete", extra={"job_id": job.id})

    except Exception as exc:
        logger.exception("[analytics_worker] job failed", extra={
            "job_id": job.id,
            "error": str(exc),
        })
        try:
            _set_phase(engine, job.id, "failed", 0, error_message=str(exc)[:2000])
        except Exception:
            logger.exception("[analytics_worker] could not mark job failed", extra={"job_id": job.id})


def _set_phase(
    engine: Any,
    job_id: str,
    phase: str,
    progress: int,
    error_message: str | None = None,
) -> None:
    with engine.begin() as conn:
        conn.execute(_sql(UPDATE_JOB_QUERY), {
            "job_id": job_id,
            "phase": phase,
            "progress": progress,
            "error_message": error_message,
        })


# ─── Extraction ───────────────────────────────────────────────────────────────

def _fetch_transcript(engine: Any, consultation_id: str) -> str:
    with engine.begin() as conn:
        result = conn.execute(_sql(FETCH_TRANSCRIPT_QUERY), {"consultation_id": consultation_id})
        rows = list(result.mappings())

    if not rows:
        raise ValueError(f"Consultation {consultation_id} not found.")
    return str(rows[0]["transcript_raw"] or "")


def _run_extraction(transcript: str) -> Any:
    from core.extraction import extract_terms_with_offsets
    from core.stop_words import filter_terms
    from core.term_normalization import normalize_terms

    result = extract_terms_with_offsets(transcript)
    result.terms = filter_terms(normalize_terms(result.terms))
    return result


def _save_extraction_result(
    engine: Any,
    job: ClaimedJob,
    extraction_result: Any,
    transcript: str,
) -> None:
    from core.config import settings

    meta = extraction_result.metadata
    extractor = "spacy" if meta.fallback_used else "langextract"
    word_count = len(transcript.split())

    with engine.begin() as conn:
        row = conn.execute(_sql(INSERT_EXTRACTION_RESULT_QUERY), {
            "consultation_id": job.consultation_id,
            "round_id": job.round_id,
            "extractor": extractor,
            "model_version": settings.openai_model,
            "transcript_word_count": word_count,
            "duration_ms": meta.duration_ms,
            "confidence": round(float(meta.confidence), 3),
            "fallback_used": meta.fallback_used,
            "reduced_recall": meta.reduced_recall,
            "error_messages": json.dumps(meta.errors),
            "result_json": json.dumps({"term_count": len(extraction_result.terms)}),
        })
        extraction_result_id = str(list(row.mappings())[0]["id"])

        for term in extraction_result.terms:
            for offset in term.offsets:
                source_span = transcript[offset.start:offset.end]
                if not source_span:
                    source_span = term.original or term.term
                conn.execute(_sql(INSERT_TERM_OFFSET_QUERY), {
                    "extraction_result_id": extraction_result_id,
                    "consultation_id": job.consultation_id,
                    "term": term.term,
                    "original": term.original or term.term,
                    "entity_type": "OTHER",
                    "confidence": round(float(term.confidence), 3),
                    "char_start": offset.start,
                    "char_end": offset.end,
                    "source_span": source_span,
                    "extraction_source": term.extraction_source,
                    "pos_tags": json.dumps(term.pos_tags),
                    "negation_context": bool(term.negation_context),
                })


# ─── Embedding ────────────────────────────────────────────────────────────────

def _run_embedding(engine: Any, job: ClaimedJob, extraction_result: Any) -> None:
    from embeddings.service import embed_terms, TermExtraction

    term_extractions = [
        TermExtraction(term=term.term, entity_type="OTHER")
        for term in extraction_result.terms
    ]
    if not term_extractions:
        logger.info("[analytics_worker] no terms to embed", extra={"job_id": job.id})
        return

    embeddings = embed_terms(term_extractions, job.consultation_id)

    with engine.begin() as conn:
        for row in embeddings:
            embedding_str = "[" + ",".join(str(x) for x in row.embedding) + "]"
            conn.execute(_sql(UPSERT_TERM_EMBEDDING_QUERY), {
                "consultation_id": row.consultation_id,
                "term": row.term,
                "entity_type": row.entity_type,
                "embedding": embedding_str,
            })

    logger.info("[analytics_worker] embeddings saved", extra={
        "job_id": job.id,
        "count": len(embeddings),
    })


# ─── Clustering ───────────────────────────────────────────────────────────────

def _run_clustering(engine: Any, job: ClaimedJob) -> None:
    from clustering.service import cluster_round_result

    with engine.begin() as conn:
        cluster_result = cluster_round_result(job.round_id, conn)

        cluster_count = len(cluster_result.clusters)
        membership_count = len(cluster_result.memberships)

        conn.execute(_sql(DELETE_ROUND_CLUSTERS_QUERY), {"round_id": job.round_id})
        conn.execute(_sql(DELETE_ROUND_MEMBERSHIPS_QUERY), {"round_id": job.round_id})

        for cluster in cluster_result.clusters:
            conn.execute(_sql(INSERT_TERM_CLUSTER_QUERY), {
                "round_id": job.round_id,
                "cluster_id": cluster.cluster_id,
                "label": cluster.label,
                "representative_terms": json.dumps(cluster.representative_terms),
                "all_terms": json.dumps(cluster.all_terms),
                "consultation_count": cluster.consultation_count,
            })

        for membership in cluster_result.memberships:
            conn.execute(_sql(INSERT_TERM_MEMBERSHIP_QUERY), {
                "round_id": job.round_id,
                "consultation_id": membership.consultation_id,
                "term": membership.term,
                "cluster_id": membership.cluster_id,
                "membership_probability": round(float(membership.membership_probability), 3),
            })

    logger.info("[analytics_worker] clustering complete", extra={
        "job_id": job.id,
        "round_id": job.round_id,
        "clusters": cluster_count,
        "memberships": membership_count,
    })


# ─── Async loop ───────────────────────────────────────────────────────────────

async def run_worker_loop(engine: Any, poll_interval: float = POLL_INTERVAL_SECONDS) -> None:
    """Async loop: runs poll_once in a thread executor so it doesn't block FastAPI."""
    loop = asyncio.get_running_loop()
    logger.info("[analytics_worker] polling loop started", extra={"poll_interval_s": poll_interval})
    while True:
        try:
            processed = await loop.run_in_executor(None, lambda: poll_once(engine))
            if processed == 0:
                await asyncio.sleep(poll_interval)
            # If a job ran, immediately check for another rather than sleeping.
        except asyncio.CancelledError:
            logger.info("[analytics_worker] polling loop stopped")
            raise
        except Exception as exc:
            logger.exception("[analytics_worker] poll error", extra={"error": str(exc)})
            await asyncio.sleep(poll_interval)
