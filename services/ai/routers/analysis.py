from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analysis", tags=["analysis"])

_db_engine: Any = None


class AnalysisStartRequest(BaseModel):
    consultation_id: str = Field(min_length=1)
    task_id: str = Field(min_length=1)


class AnalysisStartResponse(BaseModel):
    task_id: str
    status: str = "queued"


def _get_db_engine() -> Any:
    global _db_engine
    if _db_engine is None:
        from core.config import settings
        from sqlalchemy import create_engine

        url = settings.build_database_url()
        if not url:
            raise RuntimeError("DATABASE_URL not configured")
        _db_engine = create_engine(url, future=True, pool_pre_ping=True)
    return _db_engine


def _update_job(task_id: str, status: str, results: dict | None = None, error: str | None = None) -> None:
    engine = _get_db_engine()
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE cross_analysis_jobs
                SET status = :status,
                    results = CAST(:results AS jsonb),
                    error_message = :error,
                    updated_at = NOW()
                WHERE task_id = :task_id
                """
            ),
            {
                "task_id": task_id,
                "status": status,
                "results": json.dumps(results) if results is not None else None,
                "error": error,
            },
        )


def _load_transcripts(consultation_id: str) -> list[dict[str, str]]:
    engine = _get_db_engine()
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT id, title, COALESCE(transcript_raw, notes, '') AS content
                FROM meetings
                WHERE consultation_id = :consultation_id
                  AND is_archived = false
                ORDER BY updated_at DESC
                LIMIT 10
                """
            ),
            {"consultation_id": consultation_id},
        ).fetchall()

    transcripts: list[dict[str, str]] = []
    for row in rows:
        content = (row[2] or "").strip()
        if content:
            transcripts.append({"id": str(row[0]), "title": str(row[1]), "content": content[:4000]})
    return transcripts


async def _run_cross_analysis(consultation_id: str, task_id: str) -> None:
    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(None, _update_job, task_id, "running", None, None)
        transcripts = await loop.run_in_executor(None, _load_transcripts, consultation_id)
        if len(transcripts) < 2:
            await loop.run_in_executor(
                None,
                _update_job,
                task_id,
                "error",
                None,
                "Need at least two transcripts",
            )
            return

        findings = []
        for index, transcript in enumerate(transcripts[:5]):
            snippet = transcript["content"][:280].replace("\n", " ")
            findings.append(
                {
                    "id": str(uuid.uuid4()),
                    "summary": f"Pattern {index + 1} in {transcript['title']}: {snippet}…",
                    "theme_ids": [],
                }
            )

        results = {
            "pattern_count": len(findings),
            "transcript_count": len(transcripts),
            "findings": findings,
        }
        await loop.run_in_executor(None, _update_job, task_id, "complete", results, None)
    except Exception as exc:
        logger.exception("[analysis] background task failed task_id=%s", task_id)
        await loop.run_in_executor(None, _update_job, task_id, "error", None, str(exc))


@router.post("/start", response_model=AnalysisStartResponse)
async def start_analysis(request: AnalysisStartRequest):
    asyncio.create_task(_run_cross_analysis(request.consultation_id, request.task_id))
    return AnalysisStartResponse(task_id=request.task_id, status="queued")
