from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from routers import clarification, draft, themes

app = FastAPI(
    title="ConsultantPlatform AI Service",
    description="AI sidecar for theme extraction and email drafting",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(themes.router)
app.include_router(draft.router)
app.include_router(clarification.router)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": settings.openai_model,
        "endpoints": ["/themes/extract", "/draft/email", "/clarification/questions"],
    }
