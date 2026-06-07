from __future__ import annotations

import json
import logging

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from core.config import settings
from core.openai_client import get_client
from prompts.grid import GRID_SYSTEM_PROMPT, build_grid_user_prompt
from schemas.grid import (
    GridAnswer,
    GridGenerateRequest,
    GridGenerateResponse,
    GridInsight,
    GridQuote,
)

router = APIRouter(prefix="/grid", tags=["grid"])
logger = logging.getLogger(__name__)


def _generation_error(message: str) -> HTTPException:
    return HTTPException(
        status_code=500,
        detail={
            "code": "grid_generation_failed",
            "message": message,
        },
    )


def _empty_answers(request: GridGenerateRequest) -> GridGenerateResponse:
    return GridGenerateResponse(
        answers=[
            GridAnswer(
                column_id=item.column_id,
                cell_id=item.cell_id,
                insights=[],
                confidence=None,
                has_evidence=False,
            )
            for item in request.column_questions
        ]
    )


def _ground_quote(transcript: str, quote: GridQuote) -> GridQuote | None:
    if transcript[quote.span_start : quote.span_end] == quote.exact_text:
        return quote

    span_start = transcript.find(quote.exact_text)
    if span_start < 0:
        return None

    return quote.model_copy(
        update={
            "span_start": span_start,
            "span_end": span_start + len(quote.exact_text),
        }
    )


def _ground_answer(transcript: str, answer: GridAnswer) -> GridAnswer:
    grounded_insights: list[GridInsight] = []

    for insight in answer.insights:
        grounded_quotes: list[GridQuote] = []
        seen_spans: set[tuple[int, int]] = set()

        for quote in insight.quotes:
            grounded = _ground_quote(transcript, quote)
            if grounded is None:
                continue

            span = (grounded.span_start, grounded.span_end)
            if span in seen_spans:
                continue

            seen_spans.add(span)
            grounded_quotes.append(grounded)

        if grounded_quotes:
            grounded_insights.append(
                insight.model_copy(
                    update={
                        "existing_insight_id": None,
                        "quotes": grounded_quotes,
                    }
                )
            )

    if not grounded_insights:
        return answer.model_copy(
            update={
                "insights": [],
                "confidence": None,
                "has_evidence": False,
            }
        )

    return answer.model_copy(
        update={
            "insights": grounded_insights,
            "has_evidence": True,
        }
    )


def _validate_answer_set(
    request: GridGenerateRequest,
    response: GridGenerateResponse,
) -> None:
    expected = [
        (item.column_id, item.cell_id)
        for item in request.column_questions
    ]
    actual = [
        (answer.column_id, answer.cell_id)
        for answer in response.answers
    ]
    if actual != expected:
        raise _generation_error(
            "Model output did not contain exactly one ordered answer per question"
        )


@router.post("/generate", response_model=GridGenerateResponse)
async def generate_grid(request: GridGenerateRequest) -> GridGenerateResponse:
    """Extract question-specific insights and grounded quotes for one transcript."""
    if not request.transcript_raw.strip() or not request.column_questions:
        return _empty_answers(request)

    if not settings.openai_api_key:
        raise _generation_error("AI model is not configured")

    questions = [
        {
            "columnId": item.column_id,
            "question": item.question,
            "cellId": item.cell_id,
        }
        for item in request.column_questions
    ]

    try:
        completion = get_client().chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": GRID_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": build_grid_user_prompt(
                        request.transcript_raw,
                        questions,
                    ),
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
    except Exception as exc:
        logger.exception("Grid generation model call failed")
        raise _generation_error("AI model request failed") from exc

    try:
        content = completion.choices[0].message.content
    except (AttributeError, IndexError, TypeError) as exc:
        raise _generation_error("AI model returned malformed output") from exc

    if not content:
        raise _generation_error("AI model returned an empty response")

    try:
        parsed = json.loads(content)
        response = GridGenerateResponse.model_validate(parsed)
    except (json.JSONDecodeError, ValidationError) as exc:
        logger.warning("Grid generation returned malformed output: %s", exc)
        raise _generation_error("AI model returned malformed output") from exc

    _validate_answer_set(request, response)

    return GridGenerateResponse(
        answers=[
            _ground_answer(request.transcript_raw, answer)
            for answer in response.answers
        ]
    )
