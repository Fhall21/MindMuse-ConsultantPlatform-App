from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

from core.learning_analyzer import AIInsightLearning, analyze_user_signals

try:
    from celery import Celery
except ImportError:  # pragma: no cover - exercised only when celery is not installed.
    Celery = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)

DEFAULT_TOPIC_TYPE = "theme_generation"
DEFAULT_SIGNAL_LIMIT = 50

celery_app = Celery("consultantplatform_ai") if Celery else None
if celery_app:
    celery_app.conf.broker_url = "redis://localhost:6379/0"
    celery_app.conf.result_backend = "redis://localhost:6379/0"

DELETE_EXISTING_LEARNINGS_QUERY = """
DELETE FROM ai_insight_learnings
WHERE user_id = :user_id AND topic_type = :topic_type
"""

INSERT_LEARNING_QUERY = """
INSERT INTO ai_insight_learnings (
    user_id,
    topic_type,
    learning_type,
    label,
    description,
    supporting_metrics,
    created_at,
    expires_at,
    version
)
VALUES (
    :user_id,
    :topic_type,
    :learning_type,
    :label,
    :description,
    CAST(:supporting_metrics AS jsonb),
    :created_at,
    :expires_at,
    :version
)
"""


def run_compute_user_learnings(
    user_id: str,
    topic_type: str = DEFAULT_TOPIC_TYPE,
    engine: Any | None = None,
) -> Dict[str, Any]:
    db_engine = engine or _create_db_engine()
    learnings = analyze_user_signals(
        user_id,
        topic_type=topic_type,
        limit=DEFAULT_SIGNAL_LIMIT,
        engine=db_engine,
    )
    stored_count = _store_learnings(db_engine, user_id, topic_type, learnings)

    logger.info(
        "learning_analysis.completed",
        extra={
            "user_id": user_id,
            "topic_type": topic_type,
            "learning_count": stored_count,
        },
    )

    return {
        "status": "completed",
        "user_id": user_id,
        "topic_type": topic_type,
        "learning_count": stored_count,
    }


def _store_learnings(
    engine: Any,
    user_id: str,
    topic_type: str,
    learnings: list[AIInsightLearning],
) -> int:
    with engine.begin() as conn:
        conn.execute(
            _sql(DELETE_EXISTING_LEARNINGS_QUERY),
            {"user_id": user_id, "topic_type": topic_type},
        )

        for learning in learnings:
            conn.execute(
                _sql(INSERT_LEARNING_QUERY),
                {
                    "user_id": learning.user_id,
                    "topic_type": learning.topic_type,
                    "learning_type": learning.learning_type,
                    "label": learning.label,
                    "description": learning.description,
                    "supporting_metrics": json.dumps(learning.supporting_metrics),
                    "created_at": learning.created_at,
                    "expires_at": learning.expires_at,
                    "version": learning.version,
                },
            )

    return len(learnings)


def _create_db_engine() -> Any:
    from core.config import settings
    from sqlalchemy import create_engine

    database_url = settings.build_database_url()
    if not database_url:
        raise ValueError(
            "Learning task requires DATABASE_URL or DATABASE_HOST/PORT/NAME/USER/PASSWORD env vars."
        )
    return create_engine(database_url, future=True, pool_pre_ping=True)


def _sql(query: str) -> Any:
    try:
        from sqlalchemy import text
    except ModuleNotFoundError:
        return query
    return text(query)


if celery_app:

    @celery_app.task(
        bind=True,
        autoretry_for=(TimeoutError, ConnectionError),
        retry_backoff=True,
        retry_backoff_max=60,
        retry_jitter=True,
        max_retries=4,
        name="learning.compute_user_learnings",
    )
    def compute_user_learnings_task(
        self: Any,
        user_id: str,
        topic_type: str = DEFAULT_TOPIC_TYPE,
    ) -> Dict[str, Any]:
        del self
        return run_compute_user_learnings(user_id, topic_type)

else:

    def compute_user_learnings_task(
        user_id: str,
        topic_type: str = DEFAULT_TOPIC_TYPE,
    ) -> Dict[str, Any]:
        return run_compute_user_learnings(user_id, topic_type)