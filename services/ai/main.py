import asyncio
import logging
import sys
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

# Configure logging early - respect LOGLEVEL env var, default to INFO
log_level = os.getenv("LOGLEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
# Suppress noisy HTTP client debug logs unless explicitly requested
for _noisy in ("httpcore", "httpx", "openai._base_client"):
    logging.getLogger(_noisy).setLevel(logging.WARNING)

SERVICE_ROOT = Path(__file__).resolve().parent
if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))

logger_startup = logging.getLogger(__name__)
logger_startup.debug(f"[main.py startup] SERVICE_ROOT={SERVICE_ROOT}")
logger_startup.debug(f"[main.py startup] sys.path[0]={sys.path[0]}")
logger_startup.debug(f"[main.py startup] core module available: {Path(SERVICE_ROOT / 'core').exists()}")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from routers import clarification, draft, infer, ocr, rounds, shorthand, tasks, templates, themes, transcribe

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Start analytics and learning job polling workers on startup; stop them on shutdown."""
    engine = None
    worker_task: asyncio.Task | None = None  # type: ignore[type-arg]
    learning_worker_task: asyncio.Task | None = None  # type: ignore[type-arg]

    try:
        from workers.analytics_job_worker import create_db_engine, run_worker_loop
        engine = create_db_engine()
        worker_task = asyncio.create_task(run_worker_loop(engine))
        logger.info("[lifespan] analytics worker started")
    except Exception as exc:
        # Worker startup failure is non-fatal — the API still serves requests.
        logger.warning("[lifespan] analytics worker could not start: %s", exc)

    try:
        from workers.learning_job_worker import run_worker_loop as run_learning_worker_loop
        if engine is None:
            from workers.learning_job_worker import create_db_engine as create_learning_engine
            engine = create_learning_engine()
        learning_worker_task = asyncio.create_task(run_learning_worker_loop(engine))
        logger.info("[lifespan] learning worker started")
    except Exception as exc:
        logger.warning("[lifespan] learning worker could not start: %s", exc)

    try:
        yield
    finally:
        for task in (worker_task, learning_worker_task):
            if task and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        if engine is not None:
            engine.dispose()
        logger.info("[lifespan] workers stopped")


app = FastAPI(
    title="ConsultantPlatform AI Service",
    description="AI sidecar for theme extraction, email drafting, transcription, and OCR",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Stage 2 endpoints
app.include_router(themes.router)
app.include_router(draft.router)
app.include_router(clarification.router)
app.include_router(rounds.router)

# Stage 3 endpoints
app.include_router(transcribe.router)
app.include_router(ocr.router)
app.include_router(shorthand.router)
app.include_router(infer.router)

# Stage 5 endpoints
app.include_router(templates.router)
app.include_router(tasks.router)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": settings.openai_model,
        "vision_model": settings.openai_vision_model,
        "audio_model": settings.openai_audio_model,
        "endpoints": [
            "/themes/extract",
            "/draft/email",
            "/rounds/refine-group-draft",
            "/rounds/generate-summary",
            "/rounds/generate-report",
            "/rounds/generate-email",
            "/rounds/suggest-theme-groups",
            "/rounds/suggest-consultation-groups",
            "/rounds/generate-group-summary",
            "/clarification/questions",
            "/transcribe/audio",
            "/ocr/extract",
            "/shorthand/expand",
            "/templates/analyse-examples",
            "/tasks/learning/compute",
        ],
    }
