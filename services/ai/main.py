import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from routers import clarification, draft, infer, ocr, rounds, shorthand, tasks, templates, themes, transcribe

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Start the analytics job polling worker on startup; stop it on shutdown."""
    engine = None
    worker_task: asyncio.Task | None = None  # type: ignore[type-arg]

    try:
        from workers.analytics_job_worker import create_db_engine, run_worker_loop
        engine = create_db_engine()
        worker_task = asyncio.create_task(run_worker_loop(engine))
        logger.info("[lifespan] analytics worker started")
    except Exception as exc:
        # Worker startup failure is non-fatal — the API still serves requests.
        logger.warning("[lifespan] analytics worker could not start: %s", exc)

    try:
        yield
    finally:
        if worker_task and not worker_task.done():
            worker_task.cancel()
            try:
                await worker_task
            except asyncio.CancelledError:
                pass
        if engine is not None:
            engine.dispose()
        logger.info("[lifespan] analytics worker stopped")


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
