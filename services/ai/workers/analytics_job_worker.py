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
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = 10
MAX_JOB_ATTEMPTS = 3
STUCK_TIMEOUT_MINUTES = 15
RETRY_BACKOFF_MINUTES = 5

# ─── SQL ──────────────────────────────────────────────────────────────────────

# Atomically claim one queued job, incrementing attempt_count in the same statement.
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
SET phase          = 'extracting',
    progress       = 10,
    started_at     = now(),
    attempt_count  = attempt_count + 1,
    updated_at     = now()
FROM claimed
WHERE analytics_jobs.id = claimed.id
RETURNING analytics_jobs.id, analytics_jobs.meeting_id, analytics_jobs.consultation_id,
          analytics_jobs.attempt_count
"""

# Reset jobs stuck in-flight (service crashed while processing).
RESET_STUCK_JOBS_QUERY = f"""
UPDATE analytics_jobs
SET phase      = 'queued',
    progress   = 0,
    started_at = NULL,
    updated_at = now()
WHERE phase IN ('extracting', 'embedding', 'clustering', 'syncing')
  AND started_at < now() - interval '{STUCK_TIMEOUT_MINUTES} minutes'
"""

# Delete/reset very old queued jobs that have never been picked up (avoid infinite queue buildup).
# If a queued job hasn't been picked up after {STUCK_TIMEOUT_MINUTES * 2} minutes, reset it.
DELETE_STALE_QUEUED_JOBS_QUERY = f"""
UPDATE analytics_jobs
SET phase      = 'failed',
    progress   = 0,
    error_message = 'Job never started within {STUCK_TIMEOUT_MINUTES * 2} minutes; marked as failed to unblock retry queue.',
    completed_at = now(),
    updated_at   = now()
WHERE phase = 'queued'
  AND started_at IS NULL
  AND created_at < now() - interval '{STUCK_TIMEOUT_MINUTES * 2} minutes'
"""

# Clean up duplicate active jobs for meetings with multiple active jobs.
# Keeps the most recent one, deletes older duplicates.
CLEANUP_DUPLICATE_ACTIVE_JOBS_QUERY = """
DELETE FROM analytics_jobs
WHERE id IN (
    SELECT id FROM (
        SELECT
            id,
            ROW_NUMBER() OVER (PARTITION BY meeting_id ORDER BY created_at DESC) as rn
        FROM analytics_jobs
        WHERE phase IN ('queued', 'extracting', 'embedding', 'clustering', 'syncing')
    ) ranked
    WHERE rn > 1
)
"""

# Reset failed jobs that are eligible for a retry (below max attempts, past backoff window).
# Uses DISTINCT ON (meeting_id) to update at most ONE failed job per meeting per cycle.
# This prevents the case where two failed jobs for the same meeting both pass the NOT EXISTS
# check, then violate the unique constraint when both are updated to 'queued' in one statement.
RESET_RETRYABLE_FAILED_JOBS_QUERY = f"""
UPDATE analytics_jobs
SET phase         = 'queued',
    progress      = 0,
    error_message = NULL,
    completed_at  = NULL,
    updated_at    = now()
WHERE id IN (
    SELECT DISTINCT ON (meeting_id) id
    FROM analytics_jobs
    WHERE phase        = 'failed'
      AND attempt_count < {MAX_JOB_ATTEMPTS}
      AND completed_at < now() - interval '{RETRY_BACKOFF_MINUTES} minutes'
      AND NOT EXISTS (
        SELECT 1 FROM analytics_jobs AS active
        WHERE active.meeting_id = analytics_jobs.meeting_id
          AND active.phase IN ('queued', 'extracting', 'embedding', 'clustering', 'syncing')
      )
    ORDER BY meeting_id, created_at DESC
)
"""

FETCH_TRANSCRIPT_QUERY = """
SELECT transcript_raw FROM meetings WHERE id = :meeting_id
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
    meeting_id, consultation_id, extracted_at,
    extractor, model_version, transcript_word_count,
    duration_ms, confidence, fallback_used, reduced_recall,
    error_messages, result_json
) VALUES (
    :meeting_id, :consultation_id, now(),
    :extractor, :model_version, :transcript_word_count,
    :duration_ms, :confidence, :fallback_used, :reduced_recall,
    CAST(:error_messages AS jsonb), CAST(:result_json AS jsonb)
)
RETURNING id
"""

INSERT_TERM_OFFSET_QUERY = """
INSERT INTO term_extraction_offsets (
    extraction_result_id, meeting_id,
    term, original, entity_type, confidence,
    char_start, char_end, source_span,
    extraction_source, pos_tags, negation_context
) VALUES (
    :extraction_result_id, :meeting_id,
    :term, :original, :entity_type, :confidence,
    :char_start, :char_end, :source_span,
    :extraction_source, CAST(:pos_tags AS jsonb), :negation_context
)
"""

UPSERT_TERM_EMBEDDING_QUERY = """
INSERT INTO term_embeddings (meeting_id, term, entity_type, embedding)
VALUES (:meeting_id, :term, :entity_type, CAST(:embedding AS vector))
ON CONFLICT (meeting_id, term, entity_type)
DO UPDATE SET embedding = EXCLUDED.embedding
"""

DELETE_CONSULTATION_CLUSTERS_QUERY = """
DELETE FROM term_clusters WHERE consultation_id = :consultation_id
"""

DELETE_CONSULTATION_MEMBERSHIPS_QUERY = """
DELETE FROM term_cluster_memberships WHERE consultation_id = :consultation_id
"""

INSERT_TERM_CLUSTER_QUERY = """
INSERT INTO term_clusters (
    consultation_id, cluster_id, label,
    representative_terms, all_terms, meeting_count
) VALUES (
    :consultation_id, :cluster_id, :label,
    CAST(:representative_terms AS jsonb), CAST(:all_terms AS jsonb), :meeting_count
)
"""

INSERT_TERM_MEMBERSHIP_QUERY = """
INSERT INTO term_cluster_memberships (
    consultation_id, meeting_id, term, cluster_id, membership_probability
) VALUES (
    :consultation_id, :meeting_id, :term, :cluster_id, :membership_probability
)
ON CONFLICT (consultation_id, meeting_id, term)
DO UPDATE SET
    cluster_id = EXCLUDED.cluster_id,
    membership_probability = EXCLUDED.membership_probability
"""

ENSURE_ANALYTICS_PROJECTION_REFRESH_TRIGGER_QUERY = """
CREATE OR REPLACE FUNCTION enqueue_analytics_projection_refresh()
RETURNS trigger AS $$
DECLARE
    event_meeting_id uuid;
    event_consultation_id uuid;
    event_source_id uuid;
BEGIN
    IF TG_OP = 'DELETE' THEN
        event_meeting_id := OLD.meeting_id;
        event_consultation_id := OLD.consultation_id;
        event_source_id := OLD.id;
    ELSE
        event_meeting_id := NEW.meeting_id;
        event_consultation_id := NEW.consultation_id;
        event_source_id := NEW.id;
    END IF;

    INSERT INTO analytics_outbox (
        meeting_id,
        consultation_id,
        event_type,
        source_table,
        source_id,
        payload
    )
    VALUES (
        event_meeting_id,
        event_consultation_id,
        'consultation_projection_refresh',
        'extraction_results',
        event_source_id,
        jsonb_build_object(
            'meetingId', event_meeting_id,
            'consultationId', event_consultation_id,
            'sourceTable', 'extraction_results',
            'sourceId', event_source_id,
            'operation', TG_OP
        )
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_extraction_results_outbox ON extraction_results;

CREATE TRIGGER trg_extraction_results_outbox
    AFTER INSERT OR UPDATE OR DELETE ON extraction_results
    FOR EACH ROW
    EXECUTE FUNCTION enqueue_analytics_projection_refresh();
"""


# ─── Data ─────────────────────────────────────────────────────────────────────

@dataclass
class ClaimedJob:
    id: str
    meeting_id: str
    consultation_id: str | None
    attempt_count: int = 0


# ─── Engine ───────────────────────────────────────────────────────────────────

def create_db_engine() -> Any:
    from core.config import settings
    from sqlalchemy import create_engine

    database_url = settings.build_database_url()
    if not database_url:
        raise ValueError(
            "Analytics worker requires DATABASE_URL or DATABASE_HOST/PORT/NAME/USER/PASSWORD "
            "env vars (read via .env or shell environment)."
        )
    logger.info(
        "[analytics_worker] database target resolved",
        extra={
            "mode": "database_url" if settings.database_url else "discrete-env",
            "host": settings.database_host,
            "port": settings.database_port,
            "db_name": settings.database_name,
            "user": settings.database_user,
        },
    )
    return create_engine(database_url, future=True, pool_pre_ping=True)


def ensure_analytics_projection_refresh_compatibility(engine: Any) -> None:
    """Repair the analytics extraction trigger function to match the current schema."""
    with engine.begin() as conn:
        conn.execute(_sql(ENSURE_ANALYTICS_PROJECTION_REFRESH_TRIGGER_QUERY))


def _sql(query: str) -> Any:
    try:
        from sqlalchemy import text
    except ModuleNotFoundError:
        return query
    return text(query)


# ─── Poll loop ────────────────────────────────────────────────────────────────

def reset_stale_jobs(engine: Any) -> None:
    """Reset stuck in-flight jobs, clean up stale queued jobs, remove duplicates, and re-queue retryable failed jobs."""
    try:
        with engine.begin() as conn:
            stuck = conn.execute(_sql(RESET_STUCK_JOBS_QUERY))
            stale_queued = conn.execute(_sql(DELETE_STALE_QUEUED_JOBS_QUERY))
            duplicates = conn.execute(_sql(CLEANUP_DUPLICATE_ACTIVE_JOBS_QUERY))
            retryable = conn.execute(_sql(RESET_RETRYABLE_FAILED_JOBS_QUERY))
        if stuck.rowcount:
            logger.info("[analytics_worker] reset stuck in-flight jobs", extra={"count": stuck.rowcount})
        if stale_queued.rowcount:
            logger.info("[analytics_worker] marked stale queued jobs as failed", extra={"count": stale_queued.rowcount})
        if duplicates.rowcount:
            logger.info("[analytics_worker] cleaned up duplicate active jobs", extra={"count": duplicates.rowcount})
        if retryable.rowcount:
            logger.info("[analytics_worker] re-queued retryable failed jobs", extra={"count": retryable.rowcount})
    except Exception as exc:
        # Log but don't fail the worker if stale job reset has issues.
        # Worst case: some jobs don't retry until the next timeout period.
        logger.exception("[analytics_worker] error resetting stale jobs", extra={"error": str(exc)})


def poll_once(engine: Any) -> int:
    """Claim and process up to one queued job. Returns 1 if a job ran, 0 if queue was empty."""
    reset_stale_jobs(engine)

    with engine.begin() as conn:
        result = conn.execute(_sql(CLAIM_QUEUED_JOB_QUERY))
        rows = list(result.mappings())

    if not rows:
        return 0

    row = rows[0]
    job = ClaimedJob(
        id=str(row["id"]),
        meeting_id=str(row["meeting_id"]),
        consultation_id=str(row["consultation_id"]) if row["consultation_id"] else None,
        attempt_count=int(row["attempt_count"]),
    )
    _process_job(engine, job)
    return 1


# ─── Job processing ───────────────────────────────────────────────────────────

def _process_job(engine: Any, job: ClaimedJob) -> None:
    logger.info("[analytics_worker] job started", extra={
        "job_id": job.id,
        "meeting_id": job.meeting_id,
        "consultation_id": job.consultation_id,
        "attempt": job.attempt_count,
    })
    try:
        # Extraction
        transcript = _fetch_transcript(engine, job.meeting_id)
        extraction_result = _run_extraction(transcript)
        _save_extraction_result(engine, job, extraction_result, transcript)

        # Embedding
        _set_phase(engine, job.id, "embedding", 50)
        _run_embedding(engine, job, extraction_result)

        # Clustering (only when a round is set and we have enough data)
        if job.consultation_id:
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

def _fetch_transcript(engine: Any, meeting_id: str) -> str:
    with engine.begin() as conn:
        result = conn.execute(_sql(FETCH_TRANSCRIPT_QUERY), {"meeting_id": meeting_id})
        rows = list(result.mappings())

    if not rows:
        raise ValueError(f"Meeting {meeting_id} not found.")
    return str(rows[0]["transcript_raw"] or "")


def _run_extraction(transcript: str) -> Any:
    import sys
    logger.debug(f"[_run_extraction] sys.path at import time: {sys.path[:3]}")
    logger.debug(f"[_run_extraction] current working dir: {Path.cwd()}")
    try:
        from core.extraction import extract_terms_with_offsets
        from core.stop_words import filter_terms
        from core.term_normalization import normalize_terms
        logger.debug("[_run_extraction] imports successful")
    except ModuleNotFoundError as e:
        logger.error(f"[_run_extraction] import failed: {e}", exc_info=True)
        raise

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
            "meeting_id": job.meeting_id,
            "consultation_id": job.consultation_id,
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
                    "meeting_id": job.meeting_id,
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

    embeddings = embed_terms(term_extractions, job.meeting_id)

    with engine.begin() as conn:
        for row in embeddings:
            embedding_str = "[" + ",".join(str(x) for x in row.embedding) + "]"
            conn.execute(_sql(UPSERT_TERM_EMBEDDING_QUERY), {
                "meeting_id": row.meeting_id,
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

    if not job.consultation_id:
        logger.info("[analytics_worker] skipping clustering without consultation scope", extra={"job_id": job.id})
        return

    with engine.begin() as conn:
        cluster_result = cluster_round_result(job.consultation_id, conn)

        cluster_count = len(cluster_result.clusters)
        membership_count = len(cluster_result.memberships)

        conn.execute(_sql(DELETE_CONSULTATION_CLUSTERS_QUERY), {"consultation_id": job.consultation_id})
        conn.execute(_sql(DELETE_CONSULTATION_MEMBERSHIPS_QUERY), {"consultation_id": job.consultation_id})

        for cluster in cluster_result.clusters:
            conn.execute(_sql(INSERT_TERM_CLUSTER_QUERY), {
                "consultation_id": job.consultation_id,
                "cluster_id": cluster.cluster_id,
                "label": cluster.label,
                "representative_terms": json.dumps(cluster.representative_terms),
                "all_terms": json.dumps(cluster.all_terms),
                "meeting_count": cluster.meeting_count,
            })

        for membership in cluster_result.memberships:
            conn.execute(_sql(INSERT_TERM_MEMBERSHIP_QUERY), {
                "consultation_id": job.consultation_id,
                "meeting_id": membership.meeting_id,
                "term": membership.term,
                "cluster_id": membership.cluster_id,
                "membership_probability": round(float(membership.membership_probability), 3),
            })

    logger.info("[analytics_worker] clustering complete", extra={
        "job_id": job.id,
        "consultation_id": job.consultation_id,
        "clusters": cluster_count,
        "memberships": membership_count,
    })


# ─── Async loop ───────────────────────────────────────────────────────────────

async def run_worker_loop(engine: Any, poll_interval: float = POLL_INTERVAL_SECONDS) -> None:
    """Async loop: runs poll_once in a thread executor so it doesn't block FastAPI."""
    import sys
    loop = asyncio.get_running_loop()
    ensure_analytics_projection_refresh_compatibility(engine)
    logger.debug(f"[run_worker_loop] sys.path at worker start: {sys.path[:3]}")
    logger.info("[analytics_worker] polling loop started", extra={"poll_interval_s": poll_interval})
    reset_stale_jobs(engine)
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
