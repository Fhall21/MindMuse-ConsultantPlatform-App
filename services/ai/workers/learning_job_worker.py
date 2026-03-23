"""Learning analysis job polling worker.

Polls user_ai_preferences for rows where next_learning_analysis_at <= now(),
claims each one atomically (sets the column to NULL), and runs the learning
analysis inline. This is the debounce consumer: the Next.js server action
writes next_learning_analysis_at = now()+60s on each signal, so rapid-fire
accepts/rejects accumulate before a single analysis fires.

Phase transitions (within the claim CTE):
  next_learning_analysis_at IS NOT NULL (due) → NULL (claimed → processing)
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = 10

# Claim one due row atomically and return its user_id.
# Sets next_learning_analysis_at = NULL to prevent double-claiming.
CLAIM_DUE_JOB_QUERY = """
WITH claimed AS (
    UPDATE user_ai_preferences
    SET next_learning_analysis_at = NULL
    WHERE user_id = (
        SELECT user_id
        FROM user_ai_preferences
        WHERE next_learning_analysis_at IS NOT NULL
          AND next_learning_analysis_at <= now()
        ORDER BY next_learning_analysis_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    RETURNING user_id
)
SELECT user_id FROM claimed
"""


def create_db_engine() -> Any:
    from core.config import settings
    from sqlalchemy import create_engine

    database_url = settings.build_database_url()
    if not database_url:
        raise ValueError(
            "Learning job worker requires DATABASE_URL or DATABASE_HOST/PORT/NAME/USER/PASSWORD."
        )
    return create_engine(database_url, future=True, pool_pre_ping=True)


async def run_worker_loop(engine: Any) -> None:
    """Continuously poll for due learning analysis jobs."""
    logger.info("[learning_job_worker] started")
    while True:
        try:
            await _process_one(engine)
        except asyncio.CancelledError:
            logger.info("[learning_job_worker] cancelled")
            raise
        except Exception as exc:
            logger.exception("[learning_job_worker] unexpected error: %s", exc)
        await asyncio.sleep(POLL_INTERVAL_SECONDS)


async def _process_one(engine: Any) -> None:
    """Claim and process at most one due job per poll cycle."""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _claim_and_run, engine)


def _claim_and_run(engine: Any) -> None:
    try:
        from sqlalchemy import text
        sql = text(CLAIM_DUE_JOB_QUERY)
    except ModuleNotFoundError:
        sql = CLAIM_DUE_JOB_QUERY  # type: ignore[assignment]

    with engine.begin() as conn:
        row = conn.execute(sql).fetchone()

    if row is None:
        return

    user_id: str = str(row[0])
    logger.info("[learning_job_worker] claimed job for user=%s", user_id)

    try:
        from workers.learning_task import run_compute_user_learnings
        result = run_compute_user_learnings(user_id, engine=engine)
        logger.info(
            "[learning_job_worker] completed user=%s learnings=%s",
            user_id,
            result.get("learning_count"),
        )
    except Exception as exc:
        logger.exception(
            "[learning_job_worker] analysis failed for user=%s: %s", user_id, exc
        )
