from __future__ import annotations

import os

try:
    from celery import Celery
except ImportError:  # pragma: no cover - exercised only when celery is not installed.
    Celery = None  # type: ignore[assignment]


DEFAULT_CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
DEFAULT_CELERY_RESULT_BACKEND = os.getenv(
    "CELERY_RESULT_BACKEND",
    DEFAULT_CELERY_BROKER_URL,
)


celery_app = (
    Celery(
        "consultantplatform_ai",
        include=["workers.extraction_task", "workers.learning_task"],
    )
    if Celery
    else None
)

if celery_app:
    celery_app.conf.broker_url = DEFAULT_CELERY_BROKER_URL
    celery_app.conf.result_backend = DEFAULT_CELERY_RESULT_BACKEND