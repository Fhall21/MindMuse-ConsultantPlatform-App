from __future__ import annotations

import logging
from dataclasses import asdict
from typing import Any

from core.extraction import extract_terms_with_offsets
from core.stop_words import filter_terms
from core.term_normalization import normalize_terms

logger = logging.getLogger(__name__)

try:
    from celery import Celery
except ImportError:  # pragma: no cover - exercised only when celery is not installed.
    Celery = None  # type: ignore[assignment]


celery_app = Celery("consultantplatform_ai") if Celery else None
if celery_app:
    celery_app.conf.broker_url = "redis://localhost:6379/0"
    celery_app.conf.result_backend = "redis://localhost:6379/0"


def _build_output(payload: dict[str, Any]) -> dict[str, Any]:
    result = extract_terms_with_offsets(
        transcript=payload.get("transcript", ""),
        consultation_id=payload.get("consultation_id"),
        round_number=payload.get("round_number"),
    )
    normalized_terms = normalize_terms(result.terms)
    cleaned_terms = filter_terms(normalized_terms)

    result.terms = cleaned_terms
    return result.to_dict()


def _persist_extraction_result(_payload: dict[str, Any], _result: dict[str, Any]) -> None:
    # Persistence is handled by Agent 4/5 data pipeline integration.
    return None


def run_extraction(payload: dict[str, Any]) -> dict[str, Any]:
    output = _build_output(payload)
    _persist_extraction_result(payload, output)

    logger.info(
        "extraction.completed",
        extra={
            "consultation_id": payload.get("consultation_id"),
            "round_number": payload.get("round_number"),
            "term_count": len(output["terms"]),
            "fallback_used": output["metadata"]["fallback_used"],
            "reduced_recall": output["metadata"]["reduced_recall"],
            "duration_ms": output["metadata"]["duration_ms"],
            "method": output["metadata"]["extraction_method"],
        },
    )
    return output


def _execute_with_logging(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        return run_extraction(payload)
    except Exception as exc:  # noqa: BLE001
        logger.exception(
            "extraction.failed",
            extra={
                "consultation_id": payload.get("consultation_id"),
                "round_number": payload.get("round_number"),
                "error_class": exc.__class__.__name__,
                "error": str(exc),
            },
        )
        raise


if celery_app:

    @celery_app.task(
        bind=True,
        autoretry_for=(TimeoutError, ConnectionError),
        retry_backoff=True,
        retry_backoff_max=60,
        retry_jitter=True,
        max_retries=4,
        name="extraction.extract_terms",
    )
    def extraction_task(self: Any, payload: dict[str, Any]) -> dict[str, Any]:
        del self
        return _execute_with_logging(payload)

else:

    def extraction_task(payload: dict[str, Any]) -> dict[str, Any]:
        return _execute_with_logging(payload)
