"""Research session background worker.

Polls research_sessions for pending rows, claims atomically, submits to
Edison, polls until complete, then writes result_data back to the DB.

Status transitions:
  pending  → running   (worker claimed; task_id stored after Edison submit)
  running  → complete  (Edison returned success; result_data written)
  running  → failed    (Edison error, exception, or stuck timeout)
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = 10
EDISON_POLL_INTERVAL_SECONDS = 5
STUCK_TIMEOUT_MINUTES = 45

# ─── SQL ──────────────────────────────────────────────────────────────────────

CLAIM_PENDING_SESSION_QUERY = """
WITH claimed AS (
    SELECT id
    FROM research_sessions
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
)
UPDATE research_sessions
SET status     = 'running',
    updated_at = now()
FROM claimed
WHERE research_sessions.id = claimed.id
RETURNING research_sessions.id,
          research_sessions.query,
          research_sessions.industry_ctx,
          research_sessions.session_type
"""

# Reset sessions stuck in running (service crashed mid-flight).
RESET_STUCK_SESSIONS_QUERY = f"""
UPDATE research_sessions
SET status        = 'failed',
    result_data   = jsonb_build_object('error', 'Session timed out after {STUCK_TIMEOUT_MINUTES} minutes without completing'),
    completed_at  = now(),
    updated_at    = now()
WHERE status = 'running'
  AND updated_at < now() - interval '{STUCK_TIMEOUT_MINUTES} minutes'
"""

SET_TASK_ID_QUERY = """
UPDATE research_sessions
SET task_id    = :task_id,
    updated_at = now()
WHERE id = :session_id
"""

COMPLETE_SESSION_QUERY = """
UPDATE research_sessions
SET status       = 'complete',
    result_data  = CAST(:result_data AS jsonb),
    completed_at = now(),
    updated_at   = now()
WHERE id = :session_id
"""

FAIL_SESSION_QUERY = """
UPDATE research_sessions
SET status       = 'failed',
    result_data  = jsonb_build_object('error', :error_msg),
    completed_at = now(),
    updated_at   = now()
WHERE id = :session_id
"""


# ─── Engine factory ───────────────────────────────────────────────────────────

def create_db_engine() -> Any:
    from core.config import settings
    from sqlalchemy import create_engine

    database_url = settings.build_database_url()
    if not database_url:
        raise ValueError(
            "Research job worker requires DATABASE_URL or DATABASE_HOST/PORT/NAME/USER/PASSWORD."
        )
    logger.info("[research_job_worker] database target resolved host=%s", settings.database_host)
    return create_engine(database_url, future=True, pool_pre_ping=True)


# ─── Sync DB helpers (run in executor) ───────────────────────────────────────

def _claim_pending(engine: Any) -> dict[str, Any] | None:
    """Atomically claim one pending session. Returns row dict or None."""
    try:
        from sqlalchemy import text
        sql = text(CLAIM_PENDING_SESSION_QUERY)
    except ModuleNotFoundError:
        sql = CLAIM_PENDING_SESSION_QUERY  # type: ignore[assignment]

    with engine.begin() as conn:
        row = conn.execute(sql).fetchone()

    if row is None:
        return None
    return {
        "id": str(row[0]),
        "query": row[1],
        "industry_ctx": row[2],
        "session_type": row[3],
    }


def _reset_stuck(engine: Any) -> None:
    try:
        from sqlalchemy import text
        sql = text(RESET_STUCK_SESSIONS_QUERY)
    except ModuleNotFoundError:
        sql = RESET_STUCK_SESSIONS_QUERY  # type: ignore[assignment]

    with engine.begin() as conn:
        conn.execute(sql)


def _set_task_id(engine: Any, session_id: str, task_id: str) -> None:
    try:
        from sqlalchemy import text
        sql = text(SET_TASK_ID_QUERY)
    except ModuleNotFoundError:
        sql = SET_TASK_ID_QUERY  # type: ignore[assignment]

    with engine.begin() as conn:
        conn.execute(sql, {"task_id": task_id, "session_id": session_id})


def _write_complete(engine: Any, session_id: str, result_data: dict[str, Any]) -> None:
    import json
    try:
        from sqlalchemy import text
        sql = text(COMPLETE_SESSION_QUERY)
    except ModuleNotFoundError:
        sql = COMPLETE_SESSION_QUERY  # type: ignore[assignment]

    with engine.begin() as conn:
        conn.execute(sql, {"session_id": session_id, "result_data": json.dumps(result_data)})


def _write_failed(engine: Any, session_id: str, error_msg: str) -> None:
    try:
        from sqlalchemy import text
        sql = text(FAIL_SESSION_QUERY)
    except ModuleNotFoundError:
        sql = FAIL_SESSION_QUERY  # type: ignore[assignment]

    with engine.begin() as conn:
        conn.execute(sql, {"session_id": session_id, "error_msg": error_msg})


# ─── Edison execution ─────────────────────────────────────────────────────────

async def _run_literature(
    session_id: str,
    query: str,
    industry_ctx: str | None,
    engine: Any,
) -> None:
    """Submit to Edison, poll to completion, write results to DB."""
    from core.config import settings

    loop = asyncio.get_event_loop()

    if not settings.edison_api_key:
        # No API key — write stub result so the detail page can render.
        logger.info("[research_job_worker] no Edison key; writing stub result for session=%s", session_id)
        from routers.research import _stub_literature_payload
        await loop.run_in_executor(None, _write_complete, engine, session_id, _stub_literature_payload())
        return

    from edison_client import EdisonClient, JobNames  # type: ignore[import]
    from routers.research import _extract_literature_payload

    client = EdisonClient(api_key=settings.edison_api_key)
    full_query = f"[Industry context: {industry_ctx}]\n\n{query}" if industry_ctx else query

    try:
        task_id: str = await client.acreate_task({"name": JobNames.LITERATURE, "query": full_query})
    except Exception as exc:
        msg = f"Failed to submit Edison task: {exc}"
        logger.error("[research_job_worker] session=%s %s", session_id, msg)
        await loop.run_in_executor(None, _write_failed, engine, session_id, msg)
        return

    logger.info("[research_job_worker] session=%s submitted task_id=%s", session_id, task_id)
    await loop.run_in_executor(None, _set_task_id, engine, session_id, task_id)

    while True:
        await asyncio.sleep(EDISON_POLL_INTERVAL_SECONDS)
        try:
            verbose_poll = await client.aget_task(task_id, verbose=True)
        except Exception as exc:
            msg = f"Polling error: {exc}"
            logger.error("[research_job_worker] session=%s %s", session_id, msg)
            await loop.run_in_executor(None, _write_failed, engine, session_id, msg)
            return

        if verbose_poll.status == "success":
            payload = _extract_literature_payload(verbose_poll)
            await loop.run_in_executor(None, _write_complete, engine, session_id, payload)
            logger.info("[research_job_worker] session=%s complete", session_id)
            return
        elif verbose_poll.status in {"fail", "cancelled", "truncated"}:
            msg = f"Edison task ended with status: {verbose_poll.status}"
            logger.error("[research_job_worker] session=%s %s", session_id, msg)
            await loop.run_in_executor(None, _write_failed, engine, session_id, msg)
            return
        # else: still running — continue polling


# ─── Worker loop ──────────────────────────────────────────────────────────────

async def run_worker_loop(engine: Any) -> None:
    """Continuously poll for pending research sessions and process them."""
    logger.info("[research_job_worker] started")
    cycle = 0
    while True:
        try:
            # Reset stuck sessions every 10 cycles (~100s)
            if cycle % 10 == 0:
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, _reset_stuck, engine)

            await _process_one(engine)
        except asyncio.CancelledError:
            logger.info("[research_job_worker] cancelled")
            raise
        except Exception as exc:
            logger.exception("[research_job_worker] unexpected error: %s", exc)

        cycle += 1
        await asyncio.sleep(POLL_INTERVAL_SECONDS)


async def _process_one(engine: Any) -> None:
    """Claim and process at most one pending session per poll cycle."""
    loop = asyncio.get_event_loop()
    row = await loop.run_in_executor(None, _claim_pending, engine)

    if row is None:
        return

    session_id = row["id"]
    query: str = row["query"]
    industry_ctx: str | None = row["industry_ctx"]
    session_type: str = row["session_type"]

    logger.info(
        "[research_job_worker] claimed session=%s type=%s", session_id, session_type
    )

    if session_type == "literature":
        try:
            await _run_literature(session_id, query, industry_ctx, engine)
        except Exception as exc:
            logger.exception(
                "[research_job_worker] session=%s unhandled error: %s", session_id, exc
            )
            await loop.run_in_executor(
                None, _write_failed, engine, session_id, f"Unhandled error: {exc}"
            )
    else:
        # analysis and other types: mark failed until implemented
        await loop.run_in_executor(
            None,
            _write_failed,
            engine,
            session_id,
            f"Background processing not yet supported for session_type={session_type}",
        )
