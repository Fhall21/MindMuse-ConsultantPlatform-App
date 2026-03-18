from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from routers import clarification, draft, ocr, rounds, shorthand, themes, transcribe

app = FastAPI(
    title="ConsultantPlatform AI Service",
    description="AI sidecar for theme extraction, email drafting, transcription, and OCR",
    version="0.2.0",
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
            "/rounds/suggest-consultation-groups",
            "/rounds/generate-group-summary",
            "/clarification/questions",
            "/transcribe/audio",
            "/ocr/extract",
            "/shorthand/expand",
        ],
    }
