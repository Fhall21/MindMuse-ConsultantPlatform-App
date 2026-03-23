from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel

from workers.learning_task import run_compute_user_learnings

router = APIRouter(prefix="/tasks", tags=["tasks"])
logger = logging.getLogger(__name__)


class LearningTaskRequest(BaseModel):
    user_id: str
    topic_type: str = "theme_generation"


@router.post("/learning/compute", status_code=202)
async def compute_learning_task(
    request: LearningTaskRequest,
    background_tasks: BackgroundTasks,
) -> Dict[str, Any]:
    logger.info(
        "learning_analysis.request.received",
        extra={
            "user_id": request.user_id,
            "topic_type": request.topic_type,
        },
    )
    background_tasks.add_task(_run_learning, request.user_id, request.topic_type)
    return {
        "status": "accepted",
        "user_id": request.user_id,
        "topic_type": request.topic_type,
    }


def _run_learning(user_id: str, topic_type: str) -> None:
    try:
        result = run_compute_user_learnings(user_id, topic_type)
        logger.info(
            "learning_analysis.completed_inline",
            extra={
                "user_id": user_id,
                "topic_type": topic_type,
                "learning_count": result.get("learning_count"),
            },
        )
    except Exception as exc:
        logger.exception(
            "learning_analysis.failed",
            extra={
                "user_id": user_id,
                "topic_type": topic_type,
                "error_class": exc.__class__.__name__,
            },
        )
