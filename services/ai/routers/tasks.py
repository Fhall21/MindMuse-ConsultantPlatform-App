from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from workers.extraction_task import celery_app
from workers.learning_task import compute_user_learnings_task

router = APIRouter(prefix="/tasks", tags=["tasks"])


class LearningTaskRequest(BaseModel):
    user_id: str
    topic_type: str = "theme_generation"


@router.post("/learning/compute", status_code=202)
async def compute_learning_task(request: LearningTaskRequest) -> Dict[str, Any]:
    try:
        if celery_app:
            task = compute_user_learnings_task.delay(request.user_id, request.topic_type)
            return {
                "status": "queued",
                "task_id": task.id,
                "user_id": request.user_id,
                "topic_type": request.topic_type,
            }

        result = compute_user_learnings_task(request.user_id, request.topic_type)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc