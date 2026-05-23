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
          research_sessions.session_type,
          research_sessions.file_entry_id
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
        "file_entry_id": row[4],
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

    poll_cycle = 0
    while True:
        await asyncio.sleep(EDISON_POLL_INTERVAL_SECONDS)
        poll_cycle += 1
        logger.debug(
            "[research_job_worker] session=%s poll_cycle=%d", session_id, poll_cycle
        )

        try:
            verbose_poll = await asyncio.wait_for(
                client.aget_task(task_id, verbose=True),
                timeout=60.0,
            )
        except asyncio.TimeoutError:
            logger.warning(
                "[research_job_worker] session=%s poll_cycle=%d timed out, retrying",
                session_id,
                poll_cycle,
            )
            continue
        except Exception as exc:
            msg = f"Polling error: {exc}"
            logger.error("[research_job_worker] session=%s %s", session_id, msg)
            try:
                await loop.run_in_executor(None, _write_failed, engine, session_id, msg)
            except Exception:
                logger.exception(
                    "[research_job_worker] session=%s failed to write failure status",
                    session_id,
                )
            return

        if verbose_poll.status == "success":
            try:
                payload = _extract_literature_payload(verbose_poll)
                await loop.run_in_executor(None, _write_complete, engine, session_id, payload)
                logger.info("[research_job_worker] session=%s complete", session_id)
            except Exception as exc:
                msg = f"Failed to write complete result: {exc}"
                logger.exception("[research_job_worker] session=%s %s", session_id, msg)
                try:
                    await loop.run_in_executor(None, _write_failed, engine, session_id, msg)
                except Exception:
                    logger.exception(
                        "[research_job_worker] session=%s also failed to write failure status",
                        session_id,
                    )
            return
        elif verbose_poll.status in {"fail", "cancelled", "truncated"}:
            msg = f"Edison task ended with status: {verbose_poll.status}"
            logger.error("[research_job_worker] session=%s %s", session_id, msg)
            try:
                await loop.run_in_executor(None, _write_failed, engine, session_id, msg)
            except Exception:
                logger.exception(
                    "[research_job_worker] session=%s failed to write failure status",
                    session_id,
                )
            return
        # else: still running — continue polling


# ─── Analysis execution ───────────────────────────────────────────────────────

async def _run_analysis(
    session_id: str,
    query: str,
    industry_ctx: str | None,
    file_entry_id: str | None,
    engine: Any,
) -> None:
    """Submit Edison ANALYSIS job, poll to completion, write result_data + artifacts.

    Edison ANALYSIS expects the uploaded dataset to be referenced via
    `runtime_config.environment_config.data_storage_uris=["data_entry:<UUID>"]`.
    The legacy `runtime_config.file_entry_id` shape from edison-client <0.12 is
    no longer accepted.
    """
    from core.config import settings

    loop = asyncio.get_event_loop()

    if not file_entry_id:
        msg = "Analysis session is missing file_entry_id"
        logger.error("[research_job_worker] session=%s %s", session_id, msg)
        await loop.run_in_executor(None, _write_failed, engine, session_id, msg)
        return

    if not settings.edison_api_key:
        # No API key — write stub result so the panel renders something.
        logger.info(
            "[research_job_worker] no Edison key; writing stub analysis result for session=%s",
            session_id,
        )
        from routers.research import _stub_analysis_payload
        await loop.run_in_executor(None, _write_complete, engine, session_id, _stub_analysis_payload())
        return

    from edison_client import EdisonClient, JobNames  # type: ignore[import]
    from routers.research import _extract_analysis_payload, _fetch_analysis_artifacts

    client = EdisonClient(api_key=settings.edison_api_key)
    full_query = f"[Industry context: {industry_ctx}]\n\n{query}" if industry_ctx else query

    runtime_config = {
        "environment_config": {
            "data_storage_uris": [f"data_entry:{file_entry_id}"],
        }
    }

    try:
        task_id = await client.acreate_task(
            {
                "name": JobNames.ANALYSIS,
                "query": full_query,
                "runtime_config": runtime_config,
            }
        )
    except Exception as exc:
        msg = f"Failed to submit Edison analysis task: {exc}"
        logger.error("[research_job_worker] session=%s %s", session_id, msg)
        await loop.run_in_executor(None, _write_failed, engine, session_id, msg)
        return

    # `acreate_task` may return a TaskResponse, dict, or bare string depending on
    # edison-client version. Normalise.
    if hasattr(task_id, "task_id"):
        task_id = getattr(task_id, "task_id")
    elif hasattr(task_id, "trajectory_id"):
        task_id = getattr(task_id, "trajectory_id")
    elif isinstance(task_id, dict):
        task_id = task_id.get("trajectory_id") or task_id.get("task_id") or task_id.get("id")
    task_id_str = str(task_id) if task_id is not None else None
    if not task_id_str:
        msg = "Edison did not return a task id for analysis submission"
        logger.error("[research_job_worker] session=%s %s", session_id, msg)
        await loop.run_in_executor(None, _write_failed, engine, session_id, msg)
        return

    logger.info(
        "[research_job_worker] session=%s submitted analysis task_id=%s entry=%s",
        session_id,
        task_id_str,
        file_entry_id,
    )
    await loop.run_in_executor(None, _set_task_id, engine, session_id, task_id_str)

    poll_cycle = 0
    while True:
        await asyncio.sleep(EDISON_POLL_INTERVAL_SECONDS)
        poll_cycle += 1

        try:
            verbose_poll = await asyncio.wait_for(
                client.aget_task(task_id_str, verbose=True),
                timeout=60.0,
            )
        except asyncio.TimeoutError:
            logger.warning(
                "[research_job_worker] session=%s analysis poll_cycle=%d timed out, retrying",
                session_id,
                poll_cycle,
            )
            continue
        except Exception as exc:
            msg = f"Polling error: {exc}"
            logger.error("[research_job_worker] session=%s %s", session_id, msg)
            try:
                await loop.run_in_executor(None, _write_failed, engine, session_id, msg)
            except Exception:
                logger.exception(
                    "[research_job_worker] session=%s failed to write failure status",
                    session_id,
                )
            return

        status = (getattr(verbose_poll, "status", "") or "").lower()
        if status == "success":
            try:
                payload = _extract_analysis_payload(verbose_poll)
                env_frame = getattr(verbose_poll, "environment_frame", None)
                artifacts = await _fetch_analysis_artifacts(client, env_frame)
                payload["artifacts"] = artifacts
                await loop.run_in_executor(None, _write_complete, engine, session_id, payload)
                logger.info("[research_job_worker] session=%s analysis complete", session_id)
            except Exception as exc:
                msg = f"Failed to write analysis result: {exc}"
                logger.exception("[research_job_worker] session=%s %s", session_id, msg)
                try:
                    await loop.run_in_executor(None, _write_failed, engine, session_id, msg)
                except Exception:
                    logger.exception(
                        "[research_job_worker] session=%s also failed to write failure status",
                        session_id,
                    )
            return
        elif status in {"fail", "failed", "cancelled", "truncated"}:
            msg = f"Edison analysis task ended with status: {status}"
            logger.error("[research_job_worker] session=%s %s", session_id, msg)
            try:
                await loop.run_in_executor(None, _write_failed, engine, session_id, msg)
            except Exception:
                logger.exception(
                    "[research_job_worker] session=%s failed to write failure status",
                    session_id,
                )
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
    file_entry_id: str | None = row["file_entry_id"]

    logger.info(
        "[research_job_worker] claimed session=%s type=%s", session_id, session_type
    )

    try:
        if session_type == "literature":
            await _run_literature(session_id, query, industry_ctx, engine)
        elif session_type == "analysis":
            await _run_analysis(session_id, query, industry_ctx, file_entry_id, engine)
        else:
            await loop.run_in_executor(
                None,
                _write_failed,
                engine,
                session_id,
                f"Unknown session_type={session_type}",
            )
    except Exception as exc:
        logger.exception(
            "[research_job_worker] session=%s unhandled error: %s", session_id, exc
        )
        try:
            await loop.run_in_executor(
                None, _write_failed, engine, session_id, f"Unhandled error: {exc}"
            )
        except Exception:
            logger.exception(
                "[research_job_worker] session=%s failed to write failure status",
                session_id,
            )
